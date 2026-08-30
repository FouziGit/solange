/* /api/orders/transition (lot 1)
   POST {id, action, carrier?, tracking?, reason?, note?} — fait avancer
   UNE commande dans sa machine à états. Le rôle est déduit côté serveur
   (buyer/seller par comparaison d'ids) ; la table des transitions
   (src/lib/order-state) décide, jamais le client. Une transition déjà
   faite ou interdite → 409 sans double effet. */
import type { Config } from "@netlify/functions";
import {
  bad,
  currentUser,
  json,
  readJson,
  sameOrigin,
  store,
} from "./_shared/core.mts";
import { applyTransition, type OrderRecord } from "./_shared/order-core.mts";
import type { OrderAction } from "../../src/lib/order-state.ts";

const MEMBER_ACTIONS: OrderAction[] = ["ship", "cancel", "receive", "dispute"];

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connecte-toi", 401);

  const b = await readJson<{
    id?: string;
    action?: string;
    carrier?: string;
    tracking?: string;
    reason?: string;
    note?: string;
  }>(req);
  const id = (b?.id ?? "").trim();
  const action = (b?.action ?? "") as OrderAction;
  if (!id || !MEMBER_ACTIONS.includes(action))
    return bad("Action inconnue", 400);

  const order = (await store("orders").get(`o:${id}`, {
    type: "json",
  })) as OrderRecord | null;
  // 404 aussi pour un tiers : ne pas confirmer l'existence d'une commande
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id))
    return bad("Commande inconnue", 404);

  const role = order.sellerId === user.id ? "seller" : "buyer";
  if (action === "cancel" && !(b?.note ?? "").trim())
    return bad("Indique le motif de l'annulation", 400);

  const res = await applyTransition({
    orderId: id,
    action,
    role,
    by: user.id,
    carrier: b?.carrier,
    tracking: b?.tracking,
    reason: b?.reason,
    note: b?.note,
  });
  if (!res.ok) return bad(res.error, res.code);
  return json({ ok: true, order: res.order });
};

export const config: Config = { path: "/api/orders/transition" };
