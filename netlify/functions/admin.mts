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
} from "./_shared/core.mts";
import { applyTransition, type OrderRecord } from "./_shared/order-core.mts";
import { isAdmin, type ModAction } from "../../src/lib/moderation.ts";
import { CIRCLE_IDS } from "../../src/lib/circles.ts";
import { normalizeStatus } from "../../src/lib/order-state.ts";

type Report = {
  id: string;
  targetType: string;
  targetId: string;
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

/** Le contenu incriminé, résumé pour la file (sans quitter l'écran). */
async function contextOf(
  targetType: string,
  targetId: string,
): Promise<{
  label: string;
  excerpt?: string;
  image?: string;
  authorId?: string;
  authorHandle?: string;
  hidden?: boolean;
  link?: string;
} | null> {
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
  if (targetType === "user") {
    const uid = (await store("users").get(`handle:${targetId}`, {
      type: "text",
    })) as string | null;
    const rec = uid
      ? ((await store("users").get(`u:${uid}`, { type: "json" })) as Record<
          string,
          unknown
        > | null)
      : null;
    return {
      label: `@${targetId}`,
      excerpt: rec?.banned
        ? "Compte banni"
        : rec?.suspendedUntil && (rec.suspendedUntil as number) > Date.now()
          ? "Compte suspendu"
          : undefined,
      authorId: uid ?? undefined,
      authorHandle: targetId,
      link: `/membre/${targetId}`,
    };
  }
  // message : le contenu d'une conversation privée n'est PAS exposé ici.
  // L'admin voit le motif et l'auteur signalé, pas la conversation.
  return { label: "Message privé", authorHandle: targetId, link: "/admin" };
}

/** Combien de fois cet auteur a-t-il déjà été signalé ? (récidive) */
async function priorReports(handle: string | undefined): Promise<number> {
  if (!handle) return 0;
  const reports = store("reports");
  const idx = ((await reports.get("idx", { type: "json" })) as string[]) ?? [];
  let n = 0;
  for (const rid of idx.slice(-200)) {
    const r = (await reports.get(`r:${rid}`, {
      type: "json",
    })) as Report | null;
    if (r && r.targetType === "user" && r.targetId === handle) n++;
  }
  return n;
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
  const map: Record<string, [string, string]> = {
    product: ["products", `p:${targetId}`],
    post: ["posts", `l:${targetId}`],
    thread: ["circles", `t:${targetId}`],
  };
  const entry = map[targetType];
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
    const items: unknown[] = [];
    // du plus ancien au plus récent : le plus vieux est le plus urgent
    for (const rid of idx.slice(-200)) {
      const r = (await reports.get(`r:${rid}`, {
        type: "json",
      })) as Report | null;
      if (!r) continue;
      if (queue !== "all" && r.status !== (queue === "done" ? "done" : "open"))
        continue;
      const ctx = await contextOf(r.targetType, r.targetId);
      items.push({
        ...r,
        context: ctx,
        priorReports: await priorReports(ctx?.authorHandle),
      });
    }

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

  const ctx = await contextOf(report.targetType, report.targetId);
  const authorId = b.authorId || ctx?.authorId;
  const users = store("users");
  let applied = true;

  if (action === "hide") {
    applied = await setHidden(report.targetType, report.targetId, true);
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
    const rec = (await users.get(`u:${authorId}`, { type: "json" })) as Record<
      string,
      unknown
    > | null;
    if (!rec) applied = false;
    else if (action === "ban") {
      await users.setJSON(`u:${authorId}`, { ...rec, banned: true });
      // le bannissement déconnecte : pas de notification qui n'arriverait pas
    } else {
      const days = [3, 7, 30].includes(b.days ?? 0) ? b.days! : 7;
      const until = Date.now() + days * 86_400_000;
      await users.setJSON(`u:${authorId}`, { ...rec, suspendedUntil: until });
      await pushNotif(authorId, {
        type: "report",
        text: `Publication suspendue ${days} jours par la modération.`,
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
