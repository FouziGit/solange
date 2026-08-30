/* Automatismes du cycle de commande (lot 1) — Netlify Scheduled Function,
   toutes les heures. Balaie les commandes (volume beta : listage direct,
   pas d'index séparé) et applique les règles de src/lib/order-state :
   rappel vendeur J+3, annulation auto J+7, rappel acheteur J+7 après
   expédition, clôture auto J+14. Idempotent : les rappels sont marqués sur
   la commande, les transitions revalident le statut avant d'écrire, et les
   commandes seed (sellerId null) sont ignorées. */
import type { Config } from "@netlify/functions";
import { store } from "./_shared/core.mts";
import { emitOrderEvent } from "./_shared/order-events.mts";
import { applyTransition, type OrderRecord } from "./_shared/order-core.mts";
import { dueActions, normalizeStatus } from "../../src/lib/order-state.ts";

export default async () => {
  const orders = store("orders");
  const now = Date.now();
  const { blobs } = await orders.list({ prefix: "o:" });
  let acted = 0;

  for (const b of blobs) {
    const o = (await orders.get(b.key, { type: "json" })) as OrderRecord | null;
    if (!o || !o.sellerId) continue; // seed/démo : hors cycle
    const status = normalizeStatus(o.status);
    const due = dueActions(
      {
        status,
        createdAt: o.createdAt,
        shippedAt: o.shippedAt,
        remindShipAt: o.remindShipAt,
        remindReceiveAt: o.remindReceiveAt,
      },
      now,
    );

    for (const action of due) {
      acted++;
      if (action === "remind_ship") {
        await orders.setJSON(b.key, { ...o, remindShipAt: now });
        await emitOrderEvent(o, "remind_ship");
      } else if (action === "remind_receive") {
        await orders.setJSON(b.key, { ...o, remindReceiveAt: now });
        await emitOrderEvent(o, "remind_receive");
      } else if (action === "auto_cancel") {
        await applyTransition({
          orderId: o.id,
          action: "cancel",
          role: "system",
          by: "system",
          note: "Annulation automatique — pièce non expédiée sous 7 jours",
        });
      } else if (action === "auto_close") {
        await applyTransition({
          orderId: o.id,
          action: "close",
          role: "system",
          by: "system",
          note: "Clôture automatique — sans retour de l'acheteur à J+14",
        });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, acted }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = { schedule: "@hourly" };
