/* GET /api/me — session + profil + état social + commandes. Une seule
   requête d'hydratation au démarrage de l'app (mobile-friendly). */
import type { Config } from "@netlify/functions";
import { store, json, currentUser } from "./_shared/core.mts";
import { profileFields } from "./_shared/users.mts";
import { readRenameLog, renameSocial } from "./_shared/handle-migrate.mts";

export default async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return json({ user: null });

  const social = store("social");
  const key = `s:${user.id}`;
  const [cur, orderIds, log] = await Promise.all([
    social.getWithMetadata(key, { type: "json" }),
    store("orders").get(`u:${user.id}`, { type: "json" }),
    readRenameLog().catch(() => []),
  ]);

  /* Abonnements et blocages suivent les changements d'@handle des autres
     membres, avec ou sans renvoi (renameSocial) : ils ont été noués avant
     le changement, social.mts refusant d'ajouter un ancien @ masqué.
     Réécriture au mieux, un seul essai conditionnel : l'écran reçoit de
     toute façon la liste à jour. */
  const stored =
    cur?.data && typeof cur.data === "object"
      ? (cur.data as Record<string, unknown>)
      : {};
  const renamed = renameSocial(stored, log);
  if (renamed.changed && cur?.etag) {
    try {
      await social.setJSON(key, renamed.state, { onlyIfMatch: cur.etag });
    } catch {
      console.error("social_rename_error");
    }
  }

  const orders: unknown[] = [];
  for (const oid of ((orderIds as string[]) ?? []).slice(-20).reverse()) {
    const o = await store("orders").get(`o:${oid}`, { type: "json" });
    if (o) orders.push(o);
  }

  return json({
    user: {
      id: user.id,
      handle: user.handle,
      name: user.name,
      email: user.email,
      /* Preuve d'acceptation : le client s'en sert uniquement pour
         savoir s'il doit afficher l'écran de (ré)acceptation. La
         décision qui compte reste côté serveur. */
      legal: user.legal ?? null,
      ...profileFields(user),
    },
    social: {
      liked: [],
      saved: [],
      follows: [],
      joined: [],
      blocked: [],
      ...renamed.state,
    },
    orders,
  });
};

export const config: Config = { path: "/api/me" };
