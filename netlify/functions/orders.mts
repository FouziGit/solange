/* /api/orders
   POST → crée une commande (paiement SIMULÉ, assumé) : le serveur recalcule
   TOUS les montants depuis sa propre table de prix, marque la pièce vendue
   (anti double-vente) et persiste la commande. GET → mes commandes.
   Corrige : montants côté serveur, protection au centime, machine à états
   minimale disponible→vendu (audit §5.4/5.5). */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  currentUser,
  sameOrigin,
  readJson,
  sendEmail,
  userEmail,
  APP_URL,
  pushNotif,
} from "./_shared/core.mts";
import { SEED_CATALOG, commissionRate } from "./_shared/seed-catalog.mts";
import { capturePayment } from "./_shared/payment.mts";
import type { OrderRecord } from "./_shared/order-core.mts";
import { normalizeStatus } from "../../src/lib/order-state.ts";

const SHIPPING_EUR = 4.9;
/* Barème transporteur — miroir du front (src/lib/shipping.ts). */
const SHIP: Record<string, { price: number; carrier: string }> = {
  mondial_relay: { price: 3.9, carrier: "Mondial Relay" },
  point_relais: { price: 4.5, carrier: "Point Relais" },
  chronopost: { price: 6.9, carrier: "Chronopost" },
};
const cents = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";

export default async (req: Request) => {
  const user = await currentUser(req);

  if (req.method === "GET") {
    if (!user) return json({ orders: [] });
    const url = new URL(req.url);

    // ?id=X → UNE commande, acheteur ou vendeur uniquement (404 sinon —
    // ne pas confirmer l'existence à un tiers). Statut normalisé en lecture.
    const oneId = url.searchParams.get("id");
    if (oneId) {
      const o = (await store("orders").get(`o:${oneId}`, {
        type: "json",
      })) as OrderRecord | null;
      if (!o || (o.buyerId !== user.id && o.sellerId !== user.id))
        return bad("Commande inconnue", 404);
      // L'adresse de livraison à domicile n'appartient qu'aux deux parties
      // de CETTE commande — c'est déjà le périmètre de cette lecture.
      return json({
        order: {
          ...o,
          status: normalizeStatus(o.status),
          role: o.sellerId === user.id ? "seller" : "buyer",
        },
      });
    }

    // ?sales=1 → les VENTES du membre (commandes sur ses annonces)
    const asSales = url.searchParams.get("sales") === "1";
    const key = asSales ? `sales:${user.id}` : `u:${user.id}`;
    const ids =
      ((await store("orders").get(key, { type: "json" })) as string[]) ?? [];
    const orders: unknown[] = [];
    for (const oid of ids.slice(-30).reverse()) {
      const o = (await store("orders").get(`o:${oid}`, {
        type: "json",
      })) as OrderRecord | null;
      if (o) orders.push({ ...o, status: normalizeStatus(o.status) });
    }
    return json({ orders });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour acheter", 401);

  const b = await readJson<{
    productId?: string;
    shippingMethod?: string;
    relayLabel?: string;
    address?: { name?: string; line?: string; postal?: string; city?: string };
  }>(req);
  const pid = (b?.productId ?? "").trim();
  if (!pid) return bad("Article manquant");
  const method = (b?.shippingMethod ?? "").trim();
  const shipSel = SHIP[method] ?? {
    price: SHIPPING_EUR,
    carrier: "Livraison suivie",
  };
  const relayLabel =
    typeof b?.relayLabel === "string" ? b.relayLabel.slice(0, 80) : "";

  // Livraison à domicile (Chronopost) : adresse requise, validée serveur.
  // En point relais, l'adresse du relais fait foi — rien d'autre n'est stocké.
  const isHome = method === "chronopost";
  const addr = b?.address;
  const field = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  const address = isHome
    ? {
        name: field(addr?.name, 80),
        line: field(addr?.line, 120),
        postal: field(addr?.postal, 10),
        city: field(addr?.city, 60),
      }
    : undefined;
  if (
    isHome &&
    (!address?.name || !address.line || !address.postal || !address.city)
  )
    return bad("Complète l'adresse de livraison");

  const products = store("products");
  // Source de vérité prix : annonce membre (Blobs) ou catalogue seed serveur.
  const record = (await products.get(`p:${pid}`, { type: "json" })) as {
    priceEUR: number;
    brand: string;
    name: string;
    seller: string;
    sellerId?: string;
    status: string;
  } | null;
  const seedItem = SEED_CATALOG[pid];
  if (!record && !seedItem) return bad("Article inconnu", 404);

  const item = record ?? {
    ...seedItem!,
    status: "available",
    sellerId: undefined,
  };
  if (item.status !== "available")
    return bad("Cette pièce vient d'être vendue", 409);
  if (record && record.sellerId === user.id)
    return bad("Tu ne peux pas acheter ta propre annonce", 403);

  // Verrou best-effort : re-lecture juste avant écriture (beta — voir AUDIT.md)
  const fresh = (await products.get(`p:${pid}`, { type: "json" })) as {
    status?: string;
  } | null;
  if (fresh?.status === "sold")
    return bad("Cette pièce vient d'être vendue", 409);

  const price = cents(item.priceEUR);
  const protection = cents(price * 0.05); // au centime — fix audit
  const shipping = shipSel.price;
  const total = cents(price + protection + shipping);
  const shippingLabel = relayLabel
    ? `${shipSel.carrier} · ${relayLabel}`
    : shipSel.carrier;
  const rate = commissionRate(price);
  const fee = cents(price * rate);
  const net = cents(price - fee);

  const orderId = newId("o");
  const now = Date.now();
  // Paiement : UN point d'entrée (module payment.mts, simulé en beta).
  const pay = await capturePayment({
    id: orderId,
    totalEUR: total,
    buyerId: user.id,
  });
  if (!pay.ok) return bad(pay.error, 402);

  const order = {
    id: orderId,
    buyerId: user.id,
    buyerHandle: user.handle,
    productId: pid,
    brand: item.brand,
    name: item.name,
    sellerHandle: item.seller,
    sellerId: record?.sellerId ?? null,
    priceEUR: price,
    protectionEUR: protection,
    shippingEUR: shipping,
    totalEUR: total,
    shippingMethod: shipSel.carrier,
    shippingLabel,
    address, // domicile uniquement, sinon undefined
    commissionRate: rate,
    commissionEUR: fee,
    netSellerEUR: net,
    status: "payee",
    paymentRef: pay.reference,
    history: [{ at: now, by: user.id, from: "creee", to: "payee" }],
    simulated: true, // AUCUN paiement réel — beta
    createdAt: now,
  };

  // marque vendu (annonce membre : update ; pièce seed : shadow record + index)
  if (record) {
    await products.setJSON(`p:${pid}`, {
      ...record,
      status: "sold",
      soldAt: Date.now(),
    });
  } else {
    await products.setJSON(`p:${pid}`, {
      ...seedItem!,
      id: pid,
      status: "sold",
      shadow: true,
      soldAt: Date.now(),
    });
    const sold =
      ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    if (!sold.includes(pid)) {
      sold.push(pid);
      await products.setJSON("sold-seeds", sold);
    }
  }

  const orders = store("orders");
  await orders.setJSON(`o:${orderId}`, order);
  const mine =
    ((await orders.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
  mine.push(orderId);
  await orders.setJSON(`u:${user.id}`, mine);

  // Vente d'une annonce membre : index vendeur + notification email.
  if (record?.sellerId) {
    const sales =
      ((await orders.get(`sales:${record.sellerId}`, {
        type: "json",
      })) as string[]) ?? [];
    sales.push(orderId);
    await orders.setJSON(`sales:${record.sellerId}`, sales);

    await pushNotif(record.sellerId, {
      type: "sale",
      text: `Vendu : ${item.brand} ${item.name} — net ${eur(net)} · @${user.handle}`,
      link: "/profil",
    });
    // Référence la commande dans le fil de messages existant sur cette
    // pièce (aucun message fabriqué — l'en-tête du fil l'affichera).
    const msgs = store("msgs");
    const convIds =
      ((await msgs.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
    for (const cid of convIds.slice(-30)) {
      const c = (await msgs.get(`c:${cid}`, { type: "json" })) as {
        productId?: string;
        sellerId?: string | null;
        orderId?: string;
      } | null;
      if (c && c.productId === pid && c.sellerId === record.sellerId) {
        await msgs.setJSON(`c:${cid}`, { ...c, orderId });
        break;
      }
    }

    const to = await userEmail(record.sellerId);
    if (to) {
      await sendEmail(
        to,
        `Vendu — ${item.brand} ${item.name}`,
        `<p style="font-size:15px;margin:0 0 16px">Ta pièce vient d'être vendue 🎉</p>
         <p style="font-size:14px;color:#b8b3a8;margin:0 0 20px">
           <strong style="color:#f4f1ea">${item.brand} — ${item.name}</strong><br/>
           Prix : ${eur(price)} · Commission (${(rate * 100).toLocaleString("fr-FR")} %) : −${eur(fee)}<br/>
           <strong style="color:#f4f1ea">Net vendeur : ${eur(net)}</strong> · Acheteur : @${user.handle}
         </p>
         <p style="margin:0"><a href="${APP_URL}/profil" style="color:#f4f1ea">Voir mes ventes →</a></p>`,
      );
    }
  }

  return json({ ok: true, order });
};

export const config: Config = { path: "/api/orders" };
