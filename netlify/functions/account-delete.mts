/* POST /api/account/delete — suppression de compte (RGPD).
   Efface : identité, index email/handle, état social, notifications, mes
   annonces (+ photos), mes index de commandes et de conversations. Les
   conversations restent visibles côté autre participant (anonymisées par
   l'absence du compte) — documenté dans /confidentialite. */
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
  await store("social").delete(`s:${user.id}`).catch(() => {});
  await store("notifs").delete(`n:${user.id}`).catch(() => {});

  const users = store("users");
  await users.delete(`email:${sha256(user.email)}`).catch(() => {});
  await users.delete(`handle:${user.handle}`).catch(() => {});
  await users.delete(`u:${user.id}`).catch(() => {});

  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};

export const config: Config = { path: "/api/account/delete" };
