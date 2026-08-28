/* /api/orders
   POST → crée une commande (paiement SIMULÉ, assumé) : le serveur recalcule
   TOUS les montants depuis sa propre table de prix, marque la pièce vendue
   (anti double-vente) et persiste la commande. GET → mes commandes.
   Corrige : montants côté serveur, protection au centime, machine à états
   minimale disponible→vendu (audit §5.4/5.5). */
import type { Config } from "@netlify/functions";
import {
  store, json, bad, newId, currentUser, sameOrigin, readJson,
} from "./_shared/core.mts";
import { SEED_CATALOG, commissionRate } from "./_shared/seed-catalog.mts";

const SHIPPING_EUR = 4.9;
const cents = (n: number) => Math.round(n * 100) / 100;

export default async (req: Request) => {
  const user = await currentUser(req);

  if (req.method === "GET") {
    if (!user) return json({ orders: [] });
    const ids = ((await store("orders").get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
    const orders: unknown[] = [];
    for (const oid of ids.slice(-30).reverse()) {
      const o = await store("orders").get(`o:${oid}`, { type: "json" });
      if (o) orders.push(o);
    }
    return json({ orders });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour acheter", 401);

  const b = await readJson<{ productId?: string }>(req);
  const pid = (b?.productId ?? "").trim();
  if (!pid) return bad("Article manquant");

  const products = store("products");
  // Source de vérité prix : annonce membre (Blobs) ou catalogue seed serveur.
  const record = (await products.get(`p:${pid}`, { type: "json" })) as
    | { priceEUR: number; brand: string; name: string; seller: string; sellerId?: string; status: string }
    | null;
  const seedItem = SEED_CATALOG[pid];
  if (!record && !seedItem) return bad("Article inconnu", 404);

  const item = record ?? { ...seedItem!, status: "available", sellerId: undefined };
  if (item.status !== "available") return bad("Cette pièce vient d'être vendue", 409);
  if (record && record.sellerId === user.id) return bad("Tu ne peux pas acheter ta propre annonce", 403);

  // Verrou best-effort : re-lecture juste avant écriture (beta — voir AUDIT.md)
  const fresh = (await products.get(`p:${pid}`, { type: "json" })) as { status?: string } | null;
  if (fresh?.status === "sold") return bad("Cette pièce vient d'être vendue", 409);

  const price = cents(item.priceEUR);
  const protection = cents(price * 0.05); // au centime — fix audit
  const shipping = SHIPPING_EUR;
  const total = cents(price + protection + shipping);
  const rate = commissionRate(price);
  const fee = cents(price * rate);
  const net = cents(price - fee);

  const orderId = newId("o");
  const order = {
    id: orderId,
    buyerId: user.id,
    buyerHandle: user.handle,
    productId: pid,
    brand: item.brand,
    name: item.name,
    sellerHandle: item.seller,
    priceEUR: price,
    protectionEUR: protection,
    shippingEUR: shipping,
    totalEUR: total,
    commissionRate: rate,
    commissionEUR: fee,
    netSellerEUR: net,
    status: "confirmee",
    simulated: true, // AUCUN paiement réel — beta
    createdAt: Date.now(),
  };

  // marque vendu (annonce membre : update ; pièce seed : shadow record + index)
  if (record) {
    await products.setJSON(`p:${pid}`, { ...record, status: "sold", soldAt: Date.now() });
  } else {
    await products.setJSON(`p:${pid}`, { ...seedItem!, id: pid, status: "sold", shadow: true, soldAt: Date.now() });
    const sold = ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    if (!sold.includes(pid)) { sold.push(pid); await products.setJSON("sold-seeds", sold); }
  }

  const orders = store("orders");
  await orders.setJSON(`o:${orderId}`, order);
  const mine = ((await orders.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
  mine.push(orderId);
  await orders.setJSON(`u:${user.id}`, mine);

  return json({ ok: true, order });
};

export const config: Config = { path: "/api/orders" };
