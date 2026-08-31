/* /api/circles — fils de discussion RÉELS des Cercles (lot 2).
   Lecture publique (les Cercles se lisent sans compte) ; ÉCRIRE exige
   d'avoir rejoint le Cercle (l'adhésion `joined` persistée côté serveur
   fait foi — le client ne décide rien). Un seul point d'émission de
   notifications (cloche + email throttlé) — le push (lot 3) s'y branche.

   GET  ?circle=cm1   → fils triés (épinglés, puis dernière activité)
   GET  ?thread=<id>  → un fil + ses réponses
   GET  ?unread=1     → nb de Cercles rejoints avec du nouveau (session)
   POST {op:"seen"|"thread"|"reply"|"like"|"delete"|"pin", …}            */
import type { Config } from "@netlify/functions";
import {
  APP_URL,
  bad,
  assertCanWrite,
  currentUser,
  json,
  newId,
  pushNotif,
  rateLimit,
  readJson,
  sameOrigin,
  sendEmail,
  store,
  userEmail,
} from "./_shared/core.mts";
import { storeImages } from "./_shared/media.mts";
import {
  CIRCLE_IDS,
  extractMentions,
  sortThreads,
  unreadCircles,
  type CircleReply,
  type CircleThread,
} from "../../src/lib/circles.ts";

/* Source unique : src/lib/circles.ts (partagée avec la suppression de
   compte, qui doit savoir où chercher les fils d'un membre). */
const KNOWN_CIRCLES = new Set<string>(CIRCLE_IDS);

const EMAIL_THROTTLE_MS = 3_600_000; // 1 h / fil, comme les messages

async function joinedCircles(userId: string): Promise<Set<string>> {
  const s = (await store("social").get(`s:${userId}`, {
    type: "json",
  })) as { joined?: string[] } | null;
  return new Set(s?.joined ?? []);
}

async function getThread(id: string): Promise<CircleThread | null> {
  const t = (await store("circles").get(`t:${id}`, {
    type: "json",
  })) as CircleThread | null;
  // supprimé par l'auteur OU masqué par la modération (lot 4) : invisible
  return t && !t.deleted && !(t as { hidden?: boolean }).hidden ? t : null;
}

export default async (req: Request) => {
  const circles = store("circles");
  const user = await currentUser(req);

  if (req.method === "GET") {
    const url = new URL(req.url);

    const circleId = url.searchParams.get("circle");
    if (circleId) {
      const idx =
        ((await circles.get(`idx:${circleId}`, {
          type: "json",
        })) as string[]) ?? [];
      const threads: CircleThread[] = [];
      for (const id of idx.slice(-60)) {
        const t = await getThread(id);
        if (t) threads.push(t);
      }
      let lastSeenAt = 0;
      if (user) {
        const seen =
          ((await circles.get(`seen:${user.id}`, { type: "json" })) as Record<
            string,
            number
          >) ?? {};
        lastSeenAt = seen[circleId] ?? 0;
      }
      return json({
        threads: sortThreads(threads).map((t) => ({
          ...t,
          liked: user ? t.likedBy.includes(user.id) : false,
          likedBy: undefined, // la liste des membres qui aiment reste privée
          likes: t.likedBy.length,
        })),
        lastSeenAt,
      });
    }

    const threadId = url.searchParams.get("thread");
    if (threadId) {
      const t = await getThread(threadId);
      if (!t) return bad("Fil introuvable", 404);
      const replies =
        ((await circles.get(`r:${threadId}`, {
          type: "json",
        })) as CircleReply[]) ?? [];
      return json({
        thread: {
          ...t,
          liked: user ? t.likedBy.includes(user.id) : false,
          likedBy: undefined,
          likes: t.likedBy.length,
        },
        replies,
      });
    }

    if (url.searchParams.get("unread") === "1") {
      if (!user) return json({ count: 0, circleIds: [] });
      const joined = [...(await joinedCircles(user.id))].filter((id) =>
        KNOWN_CIRCLES.has(id),
      );
      const seen =
        ((await circles.get(`seen:${user.id}`, { type: "json" })) as Record<
          string,
          number
        >) ?? {};
      const lastByCircle: Record<string, number> = {};
      for (const cid of joined) {
        const idx =
          ((await circles.get(`idx:${cid}`, { type: "json" })) as string[]) ??
          [];
        let last = 0;
        for (const id of idx.slice(-20)) {
          const t = await getThread(id);
          if (t && t.lastActivityAt > last) last = t.lastActivityAt;
        }
        lastByCircle[cid] = last;
      }
      const unread = unreadCircles(joined, lastByCircle, seen);
      return json({ count: unread.length, circleIds: unread });
    }

    return bad("Requête invalide", 400);
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour participer", 401);
  // lot 4 : un membre suspendu lit tout mais ne publie rien
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;

  const b = await readJson<{
    op?: string;
    circleId?: string;
    threadId?: string;
    replyId?: string;
    title?: string;
    text?: string;
    image?: string;
    on?: boolean;
  }>(req);
  const op = b?.op ?? "";

  /* ---- marque la visite d'un Cercle (badge non-lus) ---- */
  if (op === "seen") {
    const cid = b?.circleId ?? "";
    if (!KNOWN_CIRCLES.has(cid)) return bad("Cercle inconnu", 404);
    const seen =
      ((await circles.get(`seen:${user.id}`, { type: "json" })) as Record<
        string,
        number
      >) ?? {};
    seen[cid] = Date.now();
    await circles.setJSON(`seen:${user.id}`, seen);
    return json({ ok: true });
  }

  /* ---- ouvrir un fil ---- */
  if (op === "thread") {
    const cid = b?.circleId ?? "";
    if (!KNOWN_CIRCLES.has(cid)) return bad("Cercle inconnu", 404);
    if (!(await joinedCircles(user.id)).has(cid))
      return bad("Rejoins le Cercle pour ouvrir un fil", 403);
    if (!(await rateLimit(`cthread:${user.id}`, 10, 24 * 3_600_000)))
      return bad("Limite de 10 fils par jour atteinte", 429);
    const title = (b?.title ?? "").trim().slice(0, 80);
    if (!title) return bad("Donne un titre à ton fil");
    const text = (b?.text ?? "").trim().slice(0, 1000) || undefined;
    let image: string | undefined;
    if (b?.image) {
      const stored = await storeImages([b.image], 1);
      if (!stored.ok) return bad(stored.error);
      image = stored.paths[0];
    }
    const now = Date.now();
    const thread: CircleThread = {
      id: newId("th"),
      circleId: cid,
      authorId: user.id,
      authorHandle: user.handle,
      authorName: user.name,
      title,
      text,
      image,
      createdAt: now,
      lastActivityAt: now,
      replyCount: 0,
      likedBy: [],
    };
    await circles.setJSON(`t:${thread.id}`, thread);
    const idx =
      ((await circles.get(`idx:${cid}`, { type: "json" })) as string[]) ?? [];
    idx.push(thread.id);
    await circles.setJSON(`idx:${cid}`, idx);
    return json({ ok: true, thread });
  }

  /* ---- répondre ---- */
  if (op === "reply") {
    const t = await getThread(b?.threadId ?? "");
    if (!t) return bad("Fil introuvable", 404);
    if (!(await joinedCircles(user.id)).has(t.circleId))
      return bad("Rejoins le Cercle pour répondre", 403);
    if (!(await rateLimit(`creply:${user.id}`, 60, 3_600_000)))
      return bad("Doucement — 60 réponses par heure maximum", 429);
    const text = (b?.text ?? "").trim().slice(0, 1000);
    if (!text) return bad("Écris ta réponse");

    const reply: CircleReply = {
      id: newId("cr"),
      authorId: user.id,
      authorHandle: user.handle,
      text,
      at: Date.now(),
    };
    const replies =
      ((await circles.get(`r:${t.id}`, { type: "json" })) as CircleReply[]) ??
      [];
    replies.push(reply);
    await circles.setJSON(`r:${t.id}`, replies);

    const link = `/communaute/${t.circleId}/fil/${t.id}`;
    const updated: CircleThread = {
      ...t,
      replyCount: replies.length,
      lastActivityAt: reply.at,
    };

    // auteur du fil : cloche + email throttlé 1 h/fil
    if (t.authorId !== user.id) {
      await pushNotif(t.authorId, {
        type: "circle",
        text: `@${user.handle} a répondu à ton fil « ${t.title} »`,
        link,
      });
      if (!t.lastEmailAt || reply.at - t.lastEmailAt > EMAIL_THROTTLE_MS) {
        updated.lastEmailAt = reply.at;
        const to = await userEmail(t.authorId);
        if (to)
          await sendEmail(
            to,
            `Réponse — ${t.title}`,
            `<p>@${user.handle} a répondu à ton fil « ${t.title} » :</p>
             <p style="color:#b8b3a8">${text.slice(0, 200)}</p>
             <p style="margin:16px 0 0"><a href="${APP_URL}${link}" style="color:#f4f1ea">Voir le fil →</a></p>`,
          );
      }
    }

    // @mentions : cloche avec lien profond (jamais l'auteur de la réponse)
    const users = store("users");
    for (const h of extractMentions(text, user.handle).slice(0, 5)) {
      const uid = (await users.get(`handle:${h}`, { type: "text" })) as
        string | null;
      if (uid && uid !== t.authorId)
        await pushNotif(uid, {
          type: "circle",
          text: `@${user.handle} t'a mentionné dans « ${t.title} »`,
          link,
        });
    }

    await circles.setJSON(`t:${t.id}`, updated);
    return json({ ok: true, reply });
  }

  /* ---- aimer (toggle) ---- */
  if (op === "like") {
    const t = await getThread(b?.threadId ?? "");
    if (!t) return bad("Fil introuvable", 404);
    const set = new Set(t.likedBy);
    const on = !set.has(user.id);
    if (on) set.add(user.id);
    else set.delete(user.id);
    await circles.setJSON(`t:${t.id}`, { ...t, likedBy: [...set] });
    return json({ ok: true, liked: on, likes: set.size });
  }

  /* ---- supprimer SON message ---- */
  if (op === "delete") {
    const t = await getThread(b?.threadId ?? "");
    if (!t) return bad("Fil introuvable", 404);
    if (b?.replyId) {
      const replies =
        ((await circles.get(`r:${t.id}`, {
          type: "json",
        })) as CircleReply[]) ?? [];
      const r = replies.find((x) => x.id === b.replyId);
      if (!r || r.authorId !== user.id) return bad("Réponse introuvable", 404);
      await circles.setJSON(
        `r:${t.id}`,
        replies.filter((x) => x.id !== b.replyId),
      );
      await circles.setJSON(`t:${t.id}`, {
        ...t,
        replyCount: Math.max(0, t.replyCount - 1),
      });
      return json({ ok: true });
    }
    if (t.authorId !== user.id) return bad("Fil introuvable", 404);
    // tombstone : filtré en lecture, conservé pour la modération (lot 4)
    await circles.setJSON(`t:${t.id}`, { ...t, deleted: true });
    return json({ ok: true });
  }

  /* ---- épingler — rôle admin uniquement (attribué au lot 4, D-018) ---- */
  if (op === "pin") {
    const rec = (await store("users").get(`u:${user.id}`, {
      type: "json",
    })) as { role?: string } | null;
    if (rec?.role !== "admin") return bad("Réservé aux animateurs", 403);
    const t = await getThread(b?.threadId ?? "");
    if (!t) return bad("Fil introuvable", 404);
    await circles.setJSON(`t:${t.id}`, { ...t, pinned: b?.on === true });
    return json({ ok: true });
  }

  return bad("Opération inconnue", 400);
};

export const config: Config = { path: "/api/circles" };
