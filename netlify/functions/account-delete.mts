/* POST /api/account/delete — suppression de compte (RGPD).

   EFFACE : identité, index email/handle, état social, notifications, mes
   annonces non vendues (+ photos), mes publications du feed (+ photos),
   mes index de commandes et de conversations, mes abonnements push et
   leurs préférences/compteurs, mes réponses dans les Cercles.

   ANONYMISE (plutôt qu'effacer, pour ne pas détruire la parole d'autrui) :
   mes fils de Cercle auxquels d'autres ont répondu — ils restent, signés
   « Membre supprimé », sans handle ni identifiant.

   CONSERVE : les annonces VENDUES (trace de la commande de l'acheteur) et
   les conversations côté autre participant. Documenté dans
   /confidentialite. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  sha256,
  currentUser,
  sameOrigin,
  clearSessionCookie,
} from "./_shared/core.mts";
import { PUSH_TYPES } from "../../src/lib/push-rules.ts";
import { CIRCLE_IDS } from "../../src/lib/circles.ts";

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);

  const products = store("products");
  const imgs = store("imgs");
  const idx = ((await products.get("idx", { type: "json" })) as string[]) ?? [];
  const keptIdx: string[] = [];
  for (const id of idx) {
    const p = (await products.get(`p:${id}`, { type: "json" })) as {
      sellerId?: string;
      status?: string;
      images?: string[];
    } | null;
    if (p && p.sellerId === user.id) {
      if (p.status === "sold") {
        keptIdx.push(id); // vendu = trace de commande de l'acheteur, on garde
        continue;
      }
      for (const url of p.images ?? []) {
        const iid = url.split("/").pop();
        if (iid) await imgs.delete(iid).catch(() => {});
      }
      await products.delete(`p:${id}`);
    } else if (p) keptIdx.push(id);
  }
  await products.setJSON("idx", keptIdx);

  const orders = store("orders");
  await orders.delete(`u:${user.id}`).catch(() => {});
  await orders.delete(`sales:${user.id}`).catch(() => {});
  const msgs = store("msgs");
  await msgs.delete(`u:${user.id}`).catch(() => {});
  await store("social")
    .delete(`s:${user.id}`)
    .catch(() => {});
  await store("notifs")
    .delete(`n:${user.id}`)
    .catch(() => {});
  // lot 3 : abonnements push, préférences, compteur ET les clés de
  // regroupement (une par type — sinon elles survivraient au compte)
  const push = store("push");
  await push.delete(`s:${user.id}`).catch(() => {});
  await push.delete(`p:${user.id}`).catch(() => {});
  await push.delete(`q:${user.id}`).catch(() => {});
  for (const t of PUSH_TYPES)
    await push.delete(`g:${user.id}:${t}`).catch(() => {});

  // Mes publications du feed (+ leurs photos) — même traitement que les
  // annonces : elles portent mon handle, elles partent avec le compte.
  const posts = store("posts");
  const postIdx =
    ((await posts.get("idx", { type: "json" })) as string[]) ?? [];
  const keptPosts: string[] = [];
  for (const pid of postIdx) {
    const post = (await posts.get(`l:${pid}`, { type: "json" })) as {
      authorId?: string;
      gallery?: string[];
    } | null;
    if (post && post.authorId === user.id) {
      for (const url of post.gallery ?? []) {
        const iid = url.split("/").pop();
        if (iid) await imgs.delete(iid).catch(() => {});
      }
      await posts.delete(`l:${pid}`).catch(() => {});
    } else if (post) keptPosts.push(pid);
  }
  await posts.setJSON("idx", keptPosts);

  // lot 2 : Cercles. Un fil auquel d'AUTRES ont répondu n'est pas détruit
  // (ce serait effacer la parole d'autrui) : il est ANONYMISÉ — plus de
  // handle, plus de nom, plus d'id. Mes réponses, elles, disparaissent.
  const circles = store("circles");
  await circles.delete(`seen:${user.id}`).catch(() => {});
  for (const cid of CIRCLE_IDS) {
    const tids =
      ((await circles.get(`idx:${cid}`, { type: "json" })) as string[]) ?? [];
    for (const tid of tids) {
      const t = (await circles.get(`t:${tid}`, { type: "json" })) as Record<
        string,
        unknown
      > | null;
      if (!t) continue;
      if (t.authorId === user.id) {
        await circles.setJSON(`t:${tid}`, {
          ...t,
          authorId: "",
          authorHandle: "membre-supprime",
          authorName: "Membre supprimé",
          likedBy: [],
        });
      } else if (Array.isArray(t.likedBy) && t.likedBy.includes(user.id)) {
        await circles.setJSON(`t:${tid}`, {
          ...t,
          likedBy: (t.likedBy as string[]).filter((u) => u !== user.id),
        });
      }
      const replies =
        ((await circles.get(`r:${tid}`, { type: "json" })) as {
          authorId?: string;
        }[]) ?? [];
      if (replies.some((r) => r.authorId === user.id))
        await circles.setJSON(
          `r:${tid}`,
          replies.filter((r) => r.authorId !== user.id),
        );
    }
  }

  const users = store("users");
  await users.delete(`email:${sha256(user.email)}`).catch(() => {});
  await users.delete(`handle:${user.handle}`).catch(() => {});
  await users.delete(`u:${user.id}`).catch(() => {});

  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};

export const config: Config = { path: "/api/account/delete" };
