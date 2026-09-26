/* POST /api/account/delete — suppression de compte (RGPD).

   EFFACE : identité, index email, photo de profil, état social,
   notifications, mes annonces non vendues (+ photos), mes publications du
   feed (+ photos), mes index de commandes et de conversations, mes
   abonnements push et leurs préférences/compteurs, mes réponses dans les
   Cercles.

   ANONYMISE (plutôt qu'effacer, pour ne pas détruire la parole d'autrui) :
   mes fils de Cercle auxquels d'autres ont répondu — ils restent, signés
   « Membre supprimé », sans handle ni identifiant.

   CONSERVE : les annonces VENDUES (trace de la commande de l'acheteur),
   les conversations côté autre participant, et mes identifiants (@handle)
   réduits à une pierre tombale, sans aucune autre donnée, pour qu'aucun
   tiers ne les reprenne. Documenté dans /confidentialite. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  sha256,
  currentUser,
  sameOrigin,
  clearSessionCookie,
  type UserRecord,
} from "./_shared/core.mts";
import { HANDLE_TOMBSTONE, updateUser } from "./_shared/users.mts";
import { deleteImage } from "./_shared/media.mts";
import { PUSH_TYPES } from "../../src/lib/push-rules.ts";
import { CIRCLE_IDS } from "../../src/lib/circles.ts";
import { DELETED_HANDLE, handlesOf } from "../../src/lib/handle.ts";

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
          authorHandle: DELETED_HANDLE,
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

  /* La photo est détachée par écriture conditionnelle et le compte figé
     (avatarLocked) : un envoi de photo concurrent, avec une session encore
     valide, est soit vu ici et effacé, soit refusé après, et efface alors
     son propre fichier. Aucune photo ne survit au compte. */
  const users = store("users");
  const detached = await updateUser(user.id, (r) => {
    const x = { ...r, avatarLocked: true };
    delete x.avatar;
    delete x.avatarHidden;
    return x;
  });
  const fresh = detached.ok
    ? detached.prev
    : ((await users.get(`u:${user.id}`, { type: "json" })) as UserRecord | null);
  const rec = fresh ?? user;

  /* Handles actuel, anciens et en cours : chacun devient une pierre
     tombale, jamais une clé libre. Un lien, une mention ou un blocage
     figés sur l'un d'eux ne désigneront jamais un autre membre. */
  const handles = handlesOf(rec);
  if (rec.pendingHandle?.h) handles.add(rec.pendingHandle.h);
  for (const h of handles) {
    const owner = await users.get(`handle:${h}`, { type: "text" });
    if (owner === user.id)
      await users.set(`handle:${h}`, HANDLE_TOMBSTONE).catch(() => {});
  }
  await deleteImage(rec.avatar);
  await users.delete(`email:${sha256(user.email)}`).catch(() => {});
  await users.delete(`u:${user.id}`).catch(() => {});

  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};

export const config: Config = { path: "/api/account/delete" };
