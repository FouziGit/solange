/* GET /api/profile/:handle — profil public d'un membre : identité publique,
   annonces (dispo + vendues), posts. Jamais l'email.
   Un ancien handle ne mène au profil que pendant le renvoi choisi par le
   membre ; la réponse porte alors le handle actuel, vers lequel le client
   redirige. Sinon : « Profil inconnu », comme un handle jamais pris. */
import type { Config } from "@netlify/functions";
import { store, json, bad, type UserRecord } from "./_shared/core.mts";
import { AUTHOR, PRODUCT_SELLER, overlayMembers } from "./_shared/members.mts";
import { resolveHandle } from "./_shared/users.mts";
import { userSettings } from "./settings.mts";
import { isVisible } from "../../src/lib/guards.ts";
import { publicHandleTarget } from "../../src/lib/handle.ts";
import { toPublicMember, type MemberMap } from "../../src/lib/members.ts";

export default async (req: Request) => {
  const handle = decodeURIComponent(
    new URL(req.url).pathname.split("/").pop() ?? "",
  ).toLowerCase();
  if (!/^[a-z0-9._-]{1,30}$/.test(handle)) return bad("Profil inconnu", 404);

  const users = store("users");
  const userId = await resolveHandle(handle);
  if (!userId) return bad("Profil inconnu", 404);
  const u = (await users.get(`u:${userId}`, {
    type: "json",
  })) as UserRecord | null;
  if (!u || publicHandleTarget(u, handle, Date.now()) === "hidden")
    return bad("Profil inconnu", 404);

  const products = store("products");
  const idx = ((await products.get("idx", { type: "json" })) as string[]) ?? [];
  /* Même piège qu'au Marché : tronquer AVANT de filtrer par vendeur vide
     le profil public d'un membre dès que le site dépasse 60 annonces. On
     balaie plus loin, on s'arrête dès qu'on en a assez. */
  const PAGE = 60;
  const mine: Record<string, unknown>[] = [];
  for (const id of idx.slice(-600).reverse()) {
    if (mine.length >= PAGE) break;
    const p = (await products.get(`p:${id}`, { type: "json" })) as Record<
      string,
      unknown
    > | null;
    /* isVisible : une pièce masquée par la modération disparaissait du
       Marché mais restait affichée sur le profil public de son vendeur —
       la sanction ne tenait donc que sur une surface. */
    if (isVisible(p) && p.sellerId === userId && p.status !== "withdrawn")
      mine.push(p);
  }

  const postsStore = store("posts");
  const pidx =
    ((await postsStore.get("idx", { type: "json" })) as string[]) ?? [];
  const myPosts: Record<string, unknown>[] = [];
  for (const id of pidx.slice(-300).reverse()) {
    if (myPosts.length >= 30) break;
    const p = (await postsStore.get(`l:${id}`, { type: "json" })) as Record<
      string,
      unknown
    > | null;
    if (isVisible(p) && p.authorId === userId) myPosts.push(p);
  }

  const settings = await userSettings(userId);
  // annonces et posts recouverts avec ce compte, déjà lu : aucune lecture de plus
  const member = toPublicMember({ ...u, id: userId });
  const map: MemberMap = new Map([[userId, member]]);
  return json({
    user: member,
    dmOpen: settings.dmOpen,
    products: overlayMembers(mine, [PRODUCT_SELLER], map),
    posts: overlayMembers(myPosts, [AUTHOR], map),
  });
};

export const config: Config = { path: "/api/profile/:handle" };
