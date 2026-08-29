/* GET /api/me — session + profil + état social + commandes. Une seule
   requête d'hydratation au démarrage de l'app (mobile-friendly). */
import type { Config } from "@netlify/functions";
import { store, json, currentUser } from "./_shared/core.mts";

export default async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return json({ user: null });

  const [social, orderIds] = await Promise.all([
    store("social").get(`s:${user.id}`, { type: "json" }),
    store("orders").get(`u:${user.id}`, { type: "json" }),
  ]);

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
    },
    social: (social as object) ?? {
      liked: [],
      saved: [],
      follows: [],
      joined: [],
    },
    orders,
  });
};

export const config: Config = { path: "/api/me" };
