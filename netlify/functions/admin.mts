/* /api/admin (lot 4) — file de modération, réservée aux admins.
   Un non-admin reçoit 404, jamais 403 : on ne confirme pas l'existence
   d'un espace d'administration.

   GET  ?queue=open|done|all   → signalements + litiges, contexte inclus
   POST {op:"act", …}          → action de modération (tracée)
   POST {op:"dispute", …}      → tranche un litige (via la machine du lot 1)
   GET  ?audit=1               → journal d'audit                          */
import type { Config } from "@netlify/functions";
import {
  APP_URL,
  bad,
  currentUser,
  json,
  newId,
  pushNotif,
  readJson,
  sameOrigin,
  sendEmail,
  store,
  userEmail,
  type SessionUser,
  type UserRecord,
} from "./_shared/core.mts";
import {
  deleteImage,
  quarantineImage,
  restoreImage,
} from "./_shared/media.mts";
import { mapLimit } from "./_shared/members.mts";
import { resolveHandle, updateUser } from "./_shared/users.mts";
import { lookupOwn } from "../../src/lib/guards.ts";
import { applyTransition, type OrderRecord } from "./_shared/order-core.mts";
import {
  countPriorReports,
  isAdmin,
  type ModAction,
} from "../../src/lib/moderation.ts";
import { CIRCLE_IDS } from "../../src/lib/circles.ts";
import { normalizeStatus } from "../../src/lib/order-state.ts";
import { handlesOf, normalizeHandle } from "../../src/lib/handle.ts";
import { toPublicMember } from "../../src/lib/members.ts";

/** Lectures simultanées au chargement de la file. */
const PARALLEL_READS = 10;

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  /** Membre visé (signalement de membre ou de message), résolu à la
      création. Absent sur les signalements antérieurs. */
  targetUserId?: string | null;
  reason: string;
  reporterId: string;
  reporterHandle: string;
  status: "open" | "done";
  at: number;
  resolvedBy?: string;
  resolvedAt?: number;
  action?: string;
};

async function requireAdmin(req: Request): Promise<SessionUser | null> {
  const user = await currentUser(req);
  if (!user) return null;
  const rec = (await store("users").get(`u:${user.id}`, {
    type: "json",
  })) as { role?: string; email?: string; banned?: boolean } | null;
  return isAdmin(
    { id: user.id, email: user.email, role: rec?.role, banned: rec?.banned },
    process.env.ADMIN_EMAILS,
  )
    ? user
    : null;
}

type ReportContext = {
  label: string;
  excerpt?: string;
  image?: string;
  authorId?: string;
  authorHandle?: string;
  /** Handle actuel et anciens du membre visé : sert à la récidive, ne
      part jamais vers le client. */
  handles?: string[];
  hidden?: boolean;
  link?: string;
};

/** Le contenu incriminé, résumé pour la file (sans quitter l'écran). */
async function contextOf(r: Report): Promise<ReportContext | null> {
  const { targetType, targetId } = r;
  if (targetType === "product") {
    const p = (await store("products").get(`p:${targetId}`, {
      type: "json",
    })) as Record<string, unknown> | null;
    if (!p) return null;
    return {
      label: `${p.brand ?? ""} ${p.name ?? ""}`.trim(),
      excerpt: (p.description as string) ?? undefined,
      image: (p.images as string[])?.[0],
      authorId: p.sellerId as string,
      authorHandle: p.seller as string,
      hidden: p.hidden === true,
      link: `/article/${targetId}`,
    };
  }
  if (targetType === "post") {
    const l = (await store("posts").get(`l:${targetId}`, {
      type: "json",
    })) as Record<string, unknown> | null;
    if (!l) return null;
    return {
      label: "Publication",
      excerpt: l.caption as string,
      image: (l.gallery as string[])?.[0],
      authorId: l.authorId as string,
      authorHandle: l.authorHandle as string,
      hidden: l.hidden === true,
      link: "/",
    };
  }
  if (targetType === "thread") {
    const t = (await store("circles").get(`t:${targetId}`, {
      type: "json",
    })) as Record<string, unknown> | null;
    if (!t) return null;
    return {
      label: t.title as string,
      excerpt: t.text as string,
      image: t.image as string,
      authorId: t.authorId as string,
      authorHandle: t.authorHandle as string,
      hidden: t.hidden === true,
      link: `/communaute/${t.circleId}/fil/${targetId}`,
    };
  }
  /* Membre ou message. Le membre visé a pu changer d'identifiant depuis :
     l'id noté à la création le suit ; un signalement plus ancien passe
     par son handle, alias compris (pierre tombale : personne, jamais un
     tiers). Un id resté null ne se résout pas une seconde fois, pour ne
     jamais viser qui aurait pris ce handle depuis.
     Message : le contenu de la conversation privée n'est PAS exposé ici.
     L'admin voit le motif et le membre signalé, pas la conversation. */
  const uid =
    r.targetUserId !== undefined
      ? r.targetUserId
      : await resolveHandle(normalizeHandle(targetId));
  const rec = uid
    ? ((await store("users").get(`u:${uid}`, {
        type: "json",
      })) as UserRecord | null)
    : null;
  const handle = rec?.handle ?? targetId;
  const notes = [
    rec?.banned
      ? "Compte banni"
      : rec?.suspendedUntil && rec.suspendedUntil > Date.now()
        ? "Compte suspendu"
        : null,
    rec?.avatarHidden ? "Photo masquée" : null,
  ].filter((n) => n !== null);
  return {
    label: `@${handle}`,
    excerpt: notes.join(" · ") || undefined,
    image: toPublicMember(rec)?.avatar ?? undefined,
    // compte supprimé : plus personne à avertir ni à sanctionner
    authorId: rec && uid ? uid : undefined,
    authorHandle: handle,
    handles: rec ? [...handlesOf(rec)] : [normalizeHandle(targetId)],
    hidden: targetType === "user" && rec?.avatarHidden === true,
    link: `/membre/${encodeURIComponent(handle)}`,
  };
}

/** Après un déplacement de photo : si le membre l'a retirée ou remplacée
    pendant ce temps (ou supprimé son compte), son effacement a pu passer
    avant le déplacement, qui l'a fait revenir. Le fichier ne serait plus
    rattaché à rien : on l'efface. */
async function dropIfDetached(
  userId: string,
  path: string | undefined,
): Promise<void> {
  const rec = (await store("users").get(`u:${userId}`, {
    type: "json",
  })) as UserRecord | null;
  if (rec?.avatar !== path) await deleteImage(path);
}

/** Masque la photo d'un membre : drapeaux posés sur le compte (écriture
    conditionnelle), puis le fichier passe en quarantaine, hors de
    /api/img. Le verrou l'empêche d'en publier une autre d'ici là. */
async function hideAvatar(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await updateUser(userId, (rec) =>
    rec.avatar ? { ...rec, avatarHidden: true, avatarLocked: true } : null,
  );
  if (!u.ok) return false;
  await quarantineImage(u.prev.avatar);
  await dropIfDetached(userId, u.prev.avatar);
  return true;
}

/** Rétablit la photo, puis lève le masquage et le verrou. */
async function restoreAvatar(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const rec = (await store("users").get(`u:${userId}`, {
    type: "json",
  })) as UserRecord | null;
  if (!rec) return false;
  await restoreImage(rec.avatar);
  const u = await updateUser(userId, (r) => ({
    ...r,
    avatarHidden: false,
    avatarLocked: false,
  }));
  await dropIfDetached(userId, rec.avatar);
  return u.ok;
}

async function writeAudit(entry: {
  adminId: string;
  adminHandle: string;
  action: string;
  targetType: string;
  targetId: string;
  reportId?: string;
  note?: string;
}) {
  const reports = store("reports");
  const id = newId("a");
  await reports.setJSON(`a:${id}`, { id, at: Date.now(), ...entry });
  const aidx =
    ((await reports.get("aidx", { type: "json" })) as string[]) ?? [];
  aidx.push(id);
  await reports.setJSON("aidx", aidx.slice(-500));
}

/** Masque un contenu : une seule vérité, lue par toutes les surfaces. */
async function setHidden(
  targetType: string,
  targetId: string,
  hidden: boolean,
): Promise<boolean> {
  const map: Record<string, [string, string] | null> = {
    product: ["products", `p:${targetId}`],
    post: ["posts", `l:${targetId}`],
    thread: ["circles", `t:${targetId}`],
  };
  const entry = lookupOwn<[string, string] | null>(map, targetType, null);
  if (!entry) return false;
  const [storeName, key] = entry;
  const s = store(storeName);
  const rec = (await s.get(key, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!rec) return false;
  await s.setJSON(key, { ...rec, hidden });
  return true;
}

export default async (req: Request) => {
  const admin = await requireAdmin(req);
  // 404 et non 403 : ne pas confirmer l'existence de cet espace
  if (!admin) return bad("Introuvable", 404);

  const reports = store("reports");

  if (req.method === "GET") {
    const url = new URL(req.url);

    if (url.searchParams.get("audit") === "1") {
      const aidx =
        ((await reports.get("aidx", { type: "json" })) as string[]) ?? [];
      const entries: unknown[] = [];
      for (const id of aidx.slice(-100).reverse()) {
        const a = await reports.get(`a:${id}`, { type: "json" });
        if (a) entries.push(a);
      }
      return json({ audit: entries });
    }

    const queue = url.searchParams.get("queue") ?? "open";
    const idx =
      ((await reports.get("idx", { type: "json" })) as string[]) ?? [];
    /* Les 200 derniers signalements, lus une seule fois : la file et la
       récidive de chaque auteur se calculent sur ce tableau. La récidive
       relisait les 200 pour CHAQUE élément (40 000 lectures). */
    const recent = (
      await mapLimit(
        idx.slice(-200),
        PARALLEL_READS,
        async (rid) =>
          (await reports.get(`r:${rid}`, { type: "json" })) as Report | null,
      )
    ).filter((r): r is Report => r !== null);
    // du plus ancien au plus récent : le plus vieux est le plus urgent
    const shown = recent.filter(
      (r) =>
        queue === "all" || r.status === (queue === "done" ? "done" : "open"),
    );
    const items = await mapLimit(shown, PARALLEL_READS, async (r) => {
      const ctx = await contextOf(r);
      if (!ctx) return { ...r, context: null, priorReports: 0 };
      const { handles, ...context } = ctx;
      return {
        ...r,
        context,
        priorReports: countPriorReports(recent, {
          id: ctx.authorId,
          handles: new Set(
            handles ?? (ctx.authorHandle ? [ctx.authorHandle] : []),
          ),
        }),
      };
    });

    // Litiges de commande : même file, même urgence.
    const orders = store("orders");
    const { blobs } = await orders.list({ prefix: "o:" });
    const disputes: unknown[] = [];
    for (const b of blobs) {
      const o = (await orders.get(b.key, {
        type: "json",
      })) as OrderRecord | null;
      if (!o) continue;
      const status = normalizeStatus(o.status);
      if (status !== "litige") continue;
      disputes.push({
        id: o.id,
        brand: o.brand,
        name: o.name,
        buyerHandle: o.buyerHandle,
        sellerHandle: o.sellerHandle,
        totalEUR: o.totalEUR,
        dispute: o.dispute,
        createdAt: o.createdAt,
      });
    }

    return json({ items, disputes });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);

  const b = await readJson<{
    op?: string;
    reportId?: string;
    action?: ModAction;
    targetType?: string;
    targetId?: string;
    authorId?: string;
    days?: number;
    note?: string;
    orderId?: string;
    decision?: "cancel" | "close" | "return";
  }>(req);

  /* ---- trancher un litige (via la machine à états du lot 1) ---- */
  if (b?.op === "dispute") {
    const orderId = (b.orderId ?? "").trim();
    const decision = b.decision;
    if (!orderId || !decision) return bad("Décision manquante");
    if (decision === "return") {
      // dégeler sans trancher : la commande repart d'où elle venait
      const o = (await store("orders").get(`o:${orderId}`, {
        type: "json",
      })) as OrderRecord | null;
      if (!o) return bad("Commande inconnue", 404);
      const history = o.history ?? [];
      history.push({
        at: Date.now(),
        by: "admin",
        from: "litige",
        to: "expediee",
        note: b.note?.slice(0, 200) ?? "Renvoyé aux parties",
      });
      await store("orders").setJSON(`o:${orderId}`, {
        ...o,
        status: "expediee",
        dispute: undefined,
        history,
      });
      await writeAudit({
        adminId: admin.id,
        adminHandle: admin.handle,
        action: "dispute_return",
        targetType: "order",
        targetId: orderId,
        note: b.note,
      });
      return json({ ok: true });
    }
    const res = await applyTransition({
      orderId,
      action: decision === "cancel" ? "resolve_cancel" : "resolve_close",
      role: "admin",
      by: "admin",
      note: b.note,
    });
    if (!res.ok) return bad(res.error, res.code);
    await writeAudit({
      adminId: admin.id,
      adminHandle: admin.handle,
      action: `dispute_${decision}`,
      targetType: "order",
      targetId: orderId,
      note: b.note,
    });
    return json({ ok: true });
  }

  /* ---- action de modération sur un signalement ---- */
  if (b?.op !== "act") return bad("Opération inconnue", 400);
  const action = b.action;
  const reportId = (b.reportId ?? "").trim();
  if (!action || !reportId) return bad("Action incomplète");

  const report = (await reports.get(`r:${reportId}`, {
    type: "json",
  })) as Report | null;
  if (!report) return bad("Signalement inconnu", 404);

  const ctx = await contextOf(report);
  const authorId = b.authorId || ctx?.authorId;
  let applied = true;

  if (action === "hide") {
    // un membre signalé : c'est sa photo qui est masquée
    applied =
      report.targetType === "user"
        ? await hideAvatar(authorId)
        : await setHidden(report.targetType, report.targetId, true);
    if (applied && authorId)
      await pushNotif(authorId, {
        type: "report",
        text: "Un de tes contenus a été masqué par la modération.",
        link: "/profil",
      });
  } else if (action === "warn" && authorId) {
    await pushNotif(authorId, {
      type: "report",
      text: b.note?.slice(0, 140) ?? "Avertissement de la modération.",
      link: "/profil",
    });
    const to = await userEmail(authorId);
    if (to)
      await sendEmail(
        to,
        "Avertissement — SOLANGE",
        `<p style="font-size:15px;margin:0 0 14px">Un contenu que tu as publié ne respecte pas les règles de SOLANGE.</p>
         <p style="font-size:14px;color:#b8b3a8;border-left:2px solid #3a3a3c;padding-left:12px;margin:0 0 20px">${(
           b.note ?? "Merci de relire nos règles avant de republier."
         )
           .slice(0, 400)
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")}</p>
         <p style="margin:0"><a href="${APP_URL}/profil" style="color:#f4f1ea">Mon profil →</a></p>`,
      );
  } else if ((action === "suspend" || action === "ban") && authorId) {
    /* Écriture conditionnelle sur le compte relu : une sanction ne doit
       ni écraser ni être écrasée par une écriture concurrente (photo,
       identifiant, consentement). */
    if (action === "ban") {
      const u = await updateUser(authorId, (rec) => ({ ...rec, banned: true }));
      applied = u.ok;
      // le bannissement déconnecte : pas de notification qui n'arriverait pas
    } else {
      const days = [3, 7, 30].includes(b.days ?? 0) ? b.days! : 7;
      const until = Date.now() + days * 86_400_000;
      const u = await updateUser(authorId, (rec) => ({
        ...rec,
        suspendedUntil: until,
      }));
      applied = u.ok;
      if (u.ok)
        await pushNotif(authorId, {
          type: "report",
          text: `Publication suspendue ${days} jours par la modération.`,
          link: "/profil",
        });
    }
  } else if (action === "unhide") {
    applied =
      report.targetType === "user"
        ? await restoreAvatar(authorId)
        : await setHidden(report.targetType, report.targetId, false);
    if (applied && authorId)
      await pushNotif(authorId, {
        type: "report",
        text: "Ton contenu a été rétabli après réexamen.",
        link: "/profil",
      });
  } else if (action === "unsuspend" || action === "unban") {
    /* La charte de modération annonce qu'une contestation fondée « lève la
       mesure et efface ses effets ». Aucun endpoint ne le permettait : une
       sanction était donc irréversible, et la charte inapplicable. */
    if (!authorId) applied = false;
    else {
      const u = await updateUser(authorId, (rec) => {
        const { banned, suspendedUntil, ...reste } = rec;
        void suspendedUntil;
        return action === "unban" ? reste : { ...reste, banned };
      });
      applied = u.ok;
      /* Un compte banni est déconnecté : la notification n'arriverait
         pas. Elle part pour une levée de suspension, où le membre est
         encore là pour la lire. */
      if (u.ok && action === "unsuspend")
        await pushNotif(authorId, {
          type: "report",
          text: "Ta suspension a été levée après réexamen.",
          link: "/profil",
        });
    }
  }

  await reports.setJSON(`r:${reportId}`, {
    ...report,
    status: "done",
    resolvedBy: admin.handle,
    resolvedAt: Date.now(),
    action,
  });

  await writeAudit({
    adminId: admin.id,
    adminHandle: admin.handle,
    action,
    targetType: report.targetType,
    targetId: report.targetId,
    reportId,
    note: b.note,
  });

  return json({ ok: true, applied });
};

export const config: Config = { path: "/api/admin" };
