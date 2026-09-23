/* Automatismes du cycle de commande (lot 1) — Netlify Scheduled Function,
   toutes les heures. Balaie les commandes (volume beta : listage direct,
   pas d'index séparé) et applique les règles de src/lib/order-state :
   rappel vendeur J+3, annulation auto J+7, rappel acheteur J+7 après
   expédition, clôture auto J+14. Idempotent : les rappels sont marqués sur
   la commande, les transitions revalident le statut avant d'écrire, et les
   commandes seed (sellerId null) sont ignorées. */
import type { Config } from "@netlify/functions";
import { store, pushNotif } from "./_shared/core.mts";
import { stripe } from "./_shared/stripe.mts";
import { onOrderPaid, type OrderPaye } from "./_shared/order-paid.mts";
import { emitOrderEvent } from "./_shared/order-events.mts";
import { applyTransition, type OrderRecord } from "./_shared/order-core.mts";
import { dueActions, normalizeStatus } from "../../src/lib/order-state.ts";
import {
  destinataires,
  doitRelancer,
  palierAtteint,
  texteRelance,
} from "../../src/lib/fomo.ts";

export default async () => {
  const orders = store("orders");
  const now = Date.now();
  const { blobs } = await orders.list({ prefix: "o:" });
  let acted = 0;

  for (const b of blobs) {
    const o = (await orders.get(b.key, { type: "json" })) as OrderRecord | null;
    if (!o || !o.sellerId) continue; // seed/démo : hors cycle
    const status = normalizeStatus(o.status);

    /* Commande restée « en attente » : le webhook Stripe s'est perdu, ou
       n'est jamais arrivé. On va chercher la vérité chez Stripe plutôt que
       de laisser une pièce bloquée et un acheteur sans réponse. La session
       expire au bout de 30 minutes ; au-delà de 45, son état est définitif. */
    if (status === "en_attente") {
      const sid =
        typeof o.checkoutSessionId === "string" ? o.checkoutSessionId : "";
      const s = stripe();
      if (s && sid && now - o.createdAt > 45 * 60_000) {
        try {
          const session = await s.checkout.sessions.retrieve(sid);
          if (
            session.status === "complete" &&
            session.payment_status === "paid"
          ) {
            const pi =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent?.id ?? null);
            if (pi) await orders.setJSON(b.key, { ...o, paymentIntentId: pi });
            const r = await applyTransition({
              orderId: o.id,
              action: "pay",
              role: "system",
              by: "system",
              note: "Paiement confirmé par vérification (webhook non reçu)",
            });
            if (r.ok) await onOrderPaid(r.order as unknown as OrderPaye);
            acted++;
          } else if (
            session.status === "expired" ||
            session.status === "open"
          ) {
            await applyTransition({
              orderId: o.id,
              action: "expire",
              role: "system",
              by: "system",
              note: "Paiement non finalisé dans le délai",
            });
            acted++;
          }
        } catch (e) {
          console.error("cron_session_error", o.id, (e as Error).message);
        }
      }
      continue;
    }
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

  /* ---- Relance sur les pièces gardées ----
     Quelqu'un qui a gardé une pièce veut savoir si elle commence à plaire.
     On le lui dit AVEC LE CHIFFRE VRAI, et seulement aux paliers (3, 10,
     25, 50, 100) : une pièce qui passe de 4 à 5 j'aime ne mérite pas de
     notification. Les règles sont pures et testées dans src/lib/fomo.ts ;
     ici on ne fait que lire, comparer et envoyer.

     Jamais de chiffre inventé, jamais d'urgence fabriquée : c'est la règle
     posée dans le Journal et elle vaut aussi pour les notifications. */
  let relances = 0;
  try {
    const counters = store("counters");
    const likes =
      ((await counters.get("likes", { type: "json" })) as Record<
        string,
        number
      >) ?? {};
    const dejaNotifie =
      ((await counters.get("fomo-paliers", { type: "json" })) as Record<
        string,
        number
      >) ?? {};

    const aRelancer = Object.entries(likes).filter(([id, n]) =>
      doitRelancer(n, dejaNotifie[id] ?? 0),
    );

    if (aRelancer.length) {
      // index inverse pièce → gardeurs, construit une seule fois
      const social = store("social");
      const gardeursParPiece = new Map<string, string[]>();
      const { blobs } = await social.list({ prefix: "s:" });
      for (const b of blobs) {
        const etat = (await social.get(b.key, { type: "json" })) as {
          saved?: string[];
        } | null;
        const userId = b.key.slice(2);
        for (const pieceId of etat?.saved ?? []) {
          const l = gardeursParPiece.get(pieceId) ?? [];
          l.push(userId);
          gardeursParPiece.set(pieceId, l);
        }
      }

      const products = store("products");
      for (const [pieceId, n] of aRelancer) {
        const p = (await products.get(`p:${pieceId}`, { type: "json" })) as {
          brand?: string;
          name?: string;
          sellerId?: string;
          status?: string;
          hidden?: boolean;
        } | null;
        // une pièce vendue, retirée ou masquée ne se relance pas
        if (!p || p.hidden || p.status === "withdrawn" || p.status === "sold")
          continue;
        const cibles = destinataires(gardeursParPiece, pieceId, p.sellerId);
        for (const uid of cibles) {
          await pushNotif(uid, {
            type: "gardee",
            text: texteRelance(p.brand ?? "", p.name ?? "", n),
            link: "/favoris",
          });
          relances++;
        }
        dejaNotifie[pieceId] = palierAtteint(n);
      }
      await counters.setJSON("fomo-paliers", dejaNotifie);
    }
  } catch (e) {
    // Une relance ratée ne doit jamais empêcher le traitement des commandes.
    console.error("fomo_error", (e as Error).message);
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

  return new Response(
    JSON.stringify({ ok: true, acted, relances, otpsPurges }),
    {
      headers: { "content-type": "application/json" },
    },
  );
};

export const config: Config = { schedule: "@hourly" };
