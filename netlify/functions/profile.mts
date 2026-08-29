/* GET /api/profile/:handle — profil public d'un membre : identité publique,
   annonces (dispo + vendues), posts. Jamais l'email. */
import type { Config } from "@netlify/functions";
import { store, json, bad } from "./_shared/core.mts";

export default async (req: Request) => {
  const handle = decodeURIComponent(
    new URL(req.url).pathname.split("/").pop() ?? "",
  ).toLowerCase();
  if (!/^[a-z0-9._-]{1,30}$/.test(handle)) return bad("Profil inconnu", 404);

  const users = store("users");
  const userId = (await users.get(`handle:${handle}`, { type: "text" })) as
    | string
    | null;
  if (!userId) return bad("Profil inconnu", 404);
  const u = (await users.get(`u:${userId}`, { type: "json" })) as {
    handle: string;
    name: string;
  } | null;
  if (!u) return bad("Profil inconnu", 404);

  const products = store("products");
  const idx = ((await products.get("idx", { type: "json" })) as string[]) ?? [];
  const mine: unknown[] = [];
  for (const id of idx.slice(-60).reverse()) {
    const p = (await products.get(`p:${id}`, { type: "json" })) as Record<
      string,
      unknown
    > | null;
    if (p && !p.shadow && p.sellerId === userId && p.status !== "withdrawn")
      mine.push(p);
  }

  const postsStore = store("posts");
  const pidx =
    ((await postsStore.get("idx", { type: "json" })) as string[]) ?? [];
  const myPosts: unknown[] = [];
  for (const id of pidx.slice(-30).reverse()) {
    const p = (await postsStore.get(`l:${id}`, { type: "json" })) as Record<
      string,
      unknown
    > | null;
    if (p && p.authorId === userId) myPosts.push(p);
  }

  return json({
    user: { handle: u.handle, name: u.name },
    products: mine,
    posts: myPosts,
  });
};

export const config: Config = { path: "/api/profile/:handle" };
