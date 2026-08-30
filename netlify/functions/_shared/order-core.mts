/* Application d'une transition de commande (lot 1) — LE seul endroit qui
   écrit un changement de statut. Utilisé par order-transition.mts (actions
   membres) et orders-cron.mts (automatismes). Relit la commande juste
   avant d'écrire (idempotence best-effort, même approche que l'anti
   double-vente) ; toute la validation vient de src/lib/order-state. */
import { store } from "./core.mts";
import { emitOrderEvent, type OrderEventKind } from "./order-events.mts";
import {
  nextStatus,
  normalizeStatus,
  type OrderAction,
  type OrderHistoryEntry,
  type OrderRole,
  type OrderStatus,
} from "../../../src/lib/order-state.ts";

export type OrderRecord = {
  id: string;
  buyerId: string;
  buyerHandle: string;
  productId: string;
  brand: string;
  name: string;
  sellerHandle: string;
  sellerId: string | null;
  priceEUR: number;
  totalEUR: number;
  status: string;
  createdAt: number;
  history?: OrderHistoryEntry[];
  shipment?: { carrier?: string; tracking?: string; at: number };
  dispute?: { reason: string; note?: string; at: number };
  cancelReason?: string;
  shippedAt?: number;
  remindShipAt?: number;
  remindReceiveAt?: number;
  [k: string]: unknown;
};

/** Remet une pièce en vente (annulation) : annonce membre → available,
    pièce seed → shadow record supprimé + retirée de sold-seeds. */
async function releaseProduct(pid: string) {
  const products = store("products");
  const rec = (await products.get(`p:${pid}`, { type: "json" })) as {
    shadow?: boolean;
    status?: string;
  } | null;
  if (!rec) return;
  if (rec.shadow) {
    await products.delete(`p:${pid}`);
    const sold =
      ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    if (sold.includes(pid))
      await products.setJSON(
        "sold-seeds",
        sold.filter((s) => s !== pid),
      );
  } else {
    await products.setJSON(`p:${pid}`, {
      ...rec,
      status: "available",
      soldAt: undefined,
    });
  }
}

export type TransitionInput = {
  orderId: string;
  action: OrderAction;
  role: OrderRole;
  by: string; // userId | "system" | "admin"
  carrier?: string;
  tracking?: string;
  /** Litige uniquement : "non_recue" | "non_conforme". */
  reason?: string;
  note?: string;
};

export type TransitionResult =
  { ok: true; order: OrderRecord } | { ok: false; error: string; code: number };

export async function applyTransition(
  input: TransitionInput,
): Promise<TransitionResult> {
  const orders = store("orders");
  // relecture fraîche : un double clic / un cron concurrent voit le statut réel
  const order = (await orders.get(`o:${input.orderId}`, {
    type: "json",
  })) as OrderRecord | null;
  if (!order) return { ok: false, error: "Commande inconnue", code: 404 };

  // Pièce seed (vendeur fictif) : aucun cycle — rien à expédier, personne
  // pour trancher. Protège aussi les commandes réelles historiques.
  if (!order.sellerId)
    return {
      ok: false,
      error: "Commande de démonstration — pas de cycle d'expédition",
      code: 409,
    };

  const from = normalizeStatus(order.status);
  const to = nextStatus(from, input.action, input.role);
  if (!to)
    return {
      ok: false,
      error: `Impossible depuis « ${from} »`,
      code: 409,
    };

  const now = Date.now();
  const history: OrderHistoryEntry[] = order.history ?? [
    // commandes d'avant le lot 1 : on reconstitue l'entrée de création
    { at: order.createdAt, by: order.buyerId, from: "creee", to: "payee" },
  ];
  history.push({ at: now, by: input.by, from, to, note: input.note });

  const next: OrderRecord = { ...order, status: to, history };
  const events: OrderEventKind[] = [];

  switch (input.action) {
    case "ship":
      next.shipment = {
        carrier: input.carrier?.slice(0, 40) || undefined,
        tracking: input.tracking?.slice(0, 60) || undefined,
        at: now,
      };
      next.shippedAt = now;
      events.push("expediee");
      break;
    case "cancel":
      next.cancelReason = input.note?.slice(0, 200);
      await releaseProduct(order.productId);
      events.push("annulee");
      break;
    case "receive": {
      // reçue → clôture immédiate par le système (pas d'avis : rien à attendre)
      history.push({ at: now, by: "system", from: "recue", to: "terminee" });
      next.status = "terminee";
      events.push("recue", "terminee");
      break;
    }
    case "dispute":
      next.dispute = {
        reason: input.reason === "non_conforme" ? "non_conforme" : "non_recue",
        note: input.note?.slice(0, 300),
        at: now,
      };
      events.push("litige");
      break;
    case "close":
      events.push("terminee");
      break;
    case "resolve_cancel":
      next.cancelReason = input.note?.slice(0, 200);
      await releaseProduct(order.productId);
      events.push("annulee");
      break;
    case "resolve_close":
      events.push("terminee");
      break;
  }

  await orders.setJSON(`o:${order.id}`, next);
  for (const ev of events) await emitOrderEvent(next, ev);
  return { ok: true, order: next };
}
