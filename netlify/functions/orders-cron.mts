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

  /* Purge des codes de connexion expirés. Un blob est écrit à CHAQUE
     demande de code, mais il n'est effacé qu'en cas de vérification
     réussie : toute demande abandonnée — faute de frappe, e-mail jamais
     ouvert, tentative d'abus arrêtée par le plafond — laissait donc un
     résidu définitif. Le code lui-même est haché et expire en dix minutes,
     il n'y a pas de fuite ; c'est l'accumulation qu'on nettoie. */
  let otpsPurges = 0;
  try {
    const otps = store("otps");
    const maintenant = Date.now();
    const { blobs } = await otps.list();
    for (const b of blobs) {
      const rec = (await otps.get(b.key, { type: "json" })) as {
        exp?: number;
      } | null;
      if (rec && typeof rec.exp === "number" && maintenant > rec.exp) {
        await otps.delete(b.key);
        otpsPurges++;
      }
    }
  } catch (e) {
    // Le nettoyage ne doit jamais empêcher le traitement des commandes.
    console.error("otp_purge_error", (e as Error).message);
  }

  return new Response(JSON.stringify({ ok: true, acted, otpsPurges }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = { schedule: "@hourly" };
