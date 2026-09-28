/* Automatismes du cycle de commande (lot 1) — Netlify Scheduled Function,
   toutes les heures. Balaie les commandes (volume beta : listage direct,
   pas d'index séparé) et applique les règles de src/lib/order-state :
   rappel vendeur J+3, annulation auto J+7, rappel acheteur J+7 après
   expédition, dernier rappel J+12, clôture auto J+14. Puis les règles de
   versement de src/lib/payout (D-037) : virement au vendeur des commandes
   terminées, nouvel essai quotidien, versement d'office à J+80 hors
   litige, vérification des virements envoyés, alertes sur les litiges
   qui approchent la limite Stripe de 90 jours.
   Une annulation automatique qui échoue (remboursement refusé par
   Stripe…) est retentée à chaque passage et signalée à l'équipe une fois
   par jour : sans cela, la commande restait « payée » en silence, et
   l'acheteur jamais remboursé.
   Idempotent : les rappels sont marqués sur la commande par écriture
   conditionnelle (patchOrder), les transitions revalident le statut avant
   d'écrire, et les commandes seed (sellerId null) sont ignorées. Une
   commande en erreur n'empêche jamais le traitement des suivantes. */
import type { Config } from "@netlify/functions";
import { store, pushNotif, rateLimit } from "./_shared/core.mts";
import { stripe } from "./_shared/stripe.mts";
import { onOrderPaid, type OrderPaye } from "./_shared/order-paid.mts";
import { emitOrderEvent } from "./_shared/order-events.mts";
import {
  applyTransition,
  patchOrder,
  type OrderRecord,
} from "./_shared/order-core.mts";
import { alerterAdmins } from "./_shared/admin-alert.mts";
import { verifierVersement, verserVendeur } from "./_shared/payout.mts";
import {
  dueActions,
  normalizeStatus,
  type OrderStatus,
} from "../../src/lib/order-state.ts";
import {
  payoutAction,
  type PayoutAction,
  type PayoutInput,
} from "../../src/lib/payout.ts";
import {
  destinataires,
  doitRelancer,
  palierAtteint,
  texteRelance,
} from "../../src/lib/fomo.ts";

type Marqueur = "remindShipAt" | "remindReceiveAt" | "remindReceiveLastAt";

/** Pose un marqueur de rappel, par écriture conditionnelle. Rend la
    commande écrite, ou null si le rappel n'a plus lieu d'être (statut
    changé entre-temps, marqueur déjà posé par un autre passage). */
async function marquer(
  id: string,
  champ: Marqueur,
  statut: OrderStatus,
  now: number,
): Promise<OrderRecord | null> {
  const etat = { ecrit: false };
  const r = await patchOrder(id, (fresh) => {
    etat.ecrit = normalizeStatus(fresh.status) === statut && !fresh[champ];
    return etat.ecrit ? { ...fresh, [champ]: now } : null;
  });
  return r.ok && etat.ecrit ? r.order : null;
}

function entreeVersement(o: OrderRecord): PayoutInput {
  return {
    status: normalizeStatus(o.status),
    sellerId: o.sellerId,
    payoutMode: o.payoutMode,
    simulated: o.simulated,
    paidAt: typeof o.paidAt === "number" ? o.paidAt : undefined,
    createdAt: o.createdAt,
    payout: o.payout ?? null,
    dispute: o.dispute ?? null,
    bankDispute: o.bankDispute ?? null,
    disputeAlertAt: o.disputeAlertAt,
  };
}

/** Litige (ou contestation bancaire) qui dure : les administrateurs
    doivent trancher avant la limite Stripe de 90 jours. */
async function alerterLitige(
  id: string,
  a: Extract<PayoutAction, { kind: "alert_dispute" }>,
  now: number,
) {
  const banque = a.bank ? " (contestation bancaire)" : "";
  if (a.urgency === "j85")
    await alerterAdmins({
      text: `Commande ${id}${banque} : J+85 après paiement, la limite Stripe de 90 jours approche. Trancher maintenant.`,
      link: "/admin",
      subject:
        "URGENT — SOLANGE : litige à trancher avant la limite Stripe de 90 jours",
    });
  else if (a.urgency === "j80")
    await alerterAdmins({
      text: `Litige${banque} ouvert à J+80 après paiement — commande ${id} : à trancher avant la limite Stripe de 90 jours`,
      link: "/admin",
      subject: "SOLANGE — litige à trancher",
    });
  else
    await alerterAdmins({
      text: `Litige ouvert depuis plus de 7 jours — commande ${id}`,
      link: "/admin",
    });
  await patchOrder(id, (fresh) => ({ ...fresh, disputeAlertAt: now }));
}

/** Versement de la commande, APRÈS ses automatismes : relue fraîche, elle
    a pu être close (et payée) juste avant. */
async function traiterVersement(key: string, now: number): Promise<number> {
  const cur = (await store("orders").get(key, {
    type: "json",
  })) as OrderRecord | null;
  if (!cur || !cur.sellerId) return 0;
  const action = payoutAction(entreeVersement(cur), now);
  switch (action.kind) {
    case "pay":
      await verserVendeur(cur.id, { force: action.forced, now });
      return 1;
    case "verify":
      await verifierVersement(cur.id, now);
      return 1;
    case "alert_dispute":
      await alerterLitige(cur.id, action, now);
      return 1;
    default:
      return 0;
  }
}

/* Commande restée « en attente » : le webhook Stripe s'est perdu, ou
   n'est jamais arrivé. On va chercher la vérité chez Stripe plutôt que
   de laisser une pièce bloquée et un acheteur sans réponse. La session
   expire au bout de 30 minutes ; au-delà de 45, son état est définitif. */
async function traiterEnAttente(o: OrderRecord, now: number): Promise<number> {
  const sid =
    typeof o.checkoutSessionId === "string" ? o.checkoutSessionId : "";
  const s = stripe();
  if (!s || !sid || now - o.createdAt <= 45 * 60_000) return 0;
  try {
    const session = await s.checkout.sessions.retrieve(sid);
    if (session.status === "complete" && session.payment_status === "paid") {
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      if (pi)
        await patchOrder(o.id, (fresh) =>
          fresh.paymentIntentId === pi
            ? null
            : { ...fresh, paymentIntentId: pi },
        );
      const r = await applyTransition({
        orderId: o.id,
        action: "pay",
        role: "system",
        by: "system",
        note: "Paiement confirmé par vérification (webhook non reçu)",
      });
      if (r.ok) await onOrderPaid(r.order as unknown as OrderPaye);
      return 1;
    }
    if (session.status === "expired" || session.status === "open") {
      await applyTransition({
        orderId: o.id,
        action: "expire",
        role: "system",
        by: "system",
        note: "Paiement non finalisé dans le délai",
      });
      return 1;
    }
  } catch (e) {
    console.error("cron_session_error", o.id, (e as Error).message);
  }
  return 0;
}

/** Automatismes d'UNE commande : rappels, annulation, clôture, versement. */
async function traiterCommande(key: string, now: number): Promise<number> {
  const o = (await store("orders").get(key, {
    type: "json",
  })) as OrderRecord | null;
  if (!o || !o.sellerId) return 0; // seed/démo : hors cycle
  const status = normalizeStatus(o.status);
  if (status === "en_attente") return traiterEnAttente(o, now);

  let acted = 0;
  const due = dueActions(
    {
      status,
      createdAt: o.createdAt,
      shippedAt: o.shippedAt,
      remindShipAt: o.remindShipAt,
      remindReceiveAt: o.remindReceiveAt,
      remindReceiveLastAt: o.remindReceiveLastAt,
    },
    now,
  );

  for (const action of due) {
    acted++;
    if (action === "remind_ship") {
      const m = await marquer(o.id, "remindShipAt", "payee", now);
      if (m) await emitOrderEvent(m, "remind_ship");
    } else if (action === "remind_receive") {
      const m = await marquer(o.id, "remindReceiveAt", "expediee", now);
      if (m) await emitOrderEvent(m, "remind_receive");
    } else if (action === "remind_receive_last") {
      const m = await marquer(o.id, "remindReceiveLastAt", "expediee", now);
      if (m) await emitOrderEvent(m, "remind_receive_last");
    } else if (action === "auto_cancel") {
      const r = await applyTransition({
        orderId: o.id,
        action: "cancel",
        role: "system",
        by: "system",
        note: "Annulation automatique — pièce non expédiée sous 7 jours",
      });
      /* 409 : le statut a changé entre-temps (expédiée, annulée), rien à
         signaler. Tout autre échec laisse l'acheteur sans remboursement. */
      if (
        !r.ok &&
        r.code !== 409 &&
        (await rateLimit(`auto-cancel-alert:${o.id}`, 1, 86_400_000))
      )
        await alerterAdmins({
          text: `Annulation automatique impossible — commande ${o.id}, non expédiée depuis 7 jours : ${r.error}. L'acheteur n'est pas remboursé ; nouvel essai à chaque passage du cron.`,
          link: "/admin",
          subject: "SOLANGE — annulation automatique en échec",
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

  return acted + (await traiterVersement(key, now));
}

export default async () => {
  const orders = store("orders");
  const now = Date.now();
  const { blobs } = await orders.list({ prefix: "o:" });
  let acted = 0;

  for (const b of blobs) {
    try {
      acted += await traiterCommande(b.key, now);
    } catch (e) {
      // une commande en erreur ne bloque jamais les suivantes
      console.error("cron_order_error", b.key, (e as Error).message);
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
