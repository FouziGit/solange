/* ============================================================
   SOLANGE — ce qui se passe QUAND UNE COMMANDE EST PAYÉE.

   Avant le paiement réel, tout partait au clic : notification « Vendu »,
   e-mail au vendeur, index des ventes. Avec un vrai paiement, le clic ne
   prouve rien — la carte peut être refusée, le 3-D Secure abandonné. Un
   vendeur qui reçoit « Vendu » pour une vente qui n'a pas eu lieu
   expédie parfois la pièce.

   Ces effets sont donc regroupés ici et déclenchés à UN seul moment :
   - paiement simulé : juste après la capture instantanée ;
   - paiement réel : par le webhook Stripe, quand la banque a confirmé.
   Ils ne dépendent d'aucune donnée du navigateur.
   ============================================================ */
import { store, pushNotif, sendEmail, userEmail, APP_URL } from "./core.mts";

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";

export type OrderPaye = {
  id: string;
  productId: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string | null;
  brand: string;
  name: string;
  priceEUR: number;
  commissionRate: number;
  commissionEUR: number;
  netSellerEUR: number;
};

/** Marque la pièce vendue. Idempotent : rejouer ne change rien. */
export async function marquerVendue(productId: string, orderId: string) {
  const products = store("products");
  const rec = (await products.get(`p:${productId}`, {
    type: "json",
  })) as Record<string, unknown> | null;
  if (!rec || rec.status === "sold") return;
  await products.setJSON(`p:${productId}`, {
    ...rec,
    status: "sold",
    soldAt: Date.now(),
    soldOrderId: orderId,
    reservedBy: undefined,
    reservedUntil: undefined,
  });
}

/** Libère une pièce réservée par une commande qui n'a pas abouti.
    Ne touche à rien si la pièce a été vendue entre-temps, ou réservée par
    une AUTRE commande — on ne libère que sa propre réservation. */
export async function libererReservation(productId: string, orderId: string) {
  const products = store("products");
  const rec = (await products.get(`p:${productId}`, {
    type: "json",
  })) as Record<string, unknown> | null;
  if (!rec || rec.status !== "reserved" || rec.reservedBy !== orderId) return;
  const { reservedBy, reservedUntil, ...reste } = rec;
  void reservedBy;
  void reservedUntil;
  await products.setJSON(`p:${productId}`, { ...reste, status: "available" });
}

/** Tous les effets d'une vente confirmée. */
export async function onOrderPaid(order: OrderPaye) {
  await marquerVendue(order.productId, order.id);
  if (!order.sellerId) return;

  const orders = store("orders");
  const sales =
    ((await orders.get(`sales:${order.sellerId}`, {
      type: "json",
    })) as string[]) ?? [];
  if (!sales.includes(order.id)) {
    sales.push(order.id);
    await orders.setJSON(`sales:${order.sellerId}`, sales);
  }

  await pushNotif(order.sellerId, {
    type: "sale",
    text: `Vendu : ${order.brand} ${order.name} — net ${eur(order.netSellerEUR)} · @${order.buyerHandle}`,
    link: `/commande/${order.id}`,
  });

  // Rattache la commande au fil de messages existant sur cette pièce.
  const msgs = store("msgs");
  const convIds =
    ((await msgs.get(`u:${order.buyerId}`, { type: "json" })) as string[]) ??
    [];
  for (const cid of convIds.slice(-30)) {
    const c = (await msgs.get(`c:${cid}`, { type: "json" })) as {
      productId?: string;
      sellerId?: string | null;
      orderId?: string;
    } | null;
    if (c && c.productId === order.productId && c.sellerId === order.sellerId) {
      await msgs.setJSON(`c:${cid}`, { ...c, orderId: order.id });
      break;
    }
  }

  const to = await userEmail(order.sellerId);
  if (to) {
    await sendEmail(
      to,
      `Vendu — ${order.brand} ${order.name}`,
      `<p style="font-size:15px;margin:0 0 16px">Ta pièce vient d'être vendue.</p>
       <p style="font-size:14px;color:#b8b3a8;margin:0 0 20px">
         <strong style="color:#f4f1ea">${order.brand} — ${order.name}</strong><br/>
         Prix : ${eur(order.priceEUR)} · Commission (${(order.commissionRate * 100).toLocaleString("fr-FR")} %) : −${eur(order.commissionEUR)}<br/>
         <strong style="color:#f4f1ea">Net vendeur : ${eur(order.netSellerEUR)}</strong> · Acheteur : @${order.buyerHandle}
       </p>
       <p style="font-size:14px;color:#b8b3a8;margin:0 0 20px">Expédie sous 3 jours et renseigne le suivi dans l'app.</p>
       <p style="margin:0"><a href="${APP_URL}/commande/${order.id}" style="color:#f4f1ea">Voir la commande →</a></p>`,
    );
  }
}
