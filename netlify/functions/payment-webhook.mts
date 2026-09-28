/* /api/payment/webhook — LA SEULE VOIX QUI DIT « C'EST PAYÉ ».

   Le navigateur de l'acheteur ne décide de rien : il peut fermer l'onglet
   avant la redirection, ou revenir sur la page de succès sans avoir payé.
   Seul Stripe, signé, fait passer une commande de `en_attente` à `payee`.

   SIGNATURE : vérifiée sur le corps BRUT (req.text()). Le piège classique
   est de parser le JSON avant : la signature porte sur les octets exacts,
   un JSON reformaté ne la vérifie plus jamais.

   IDEMPOTENCE : Stripe rejoue un événement tant qu'il n'a pas reçu de 2xx,
   et peut le livrer en double. La machine à états fait le travail :
   `pay` n'est permis que depuis `en_attente`, donc un second passage est
   refusé et on répond 200 sans rien refaire. Les effets de vente ne
   partent que sur une transition RÉUSSIE.

   ÉCRITURES sur `o:<id>` : conditionnelles (patchOrder, etag), comme
   partout ailleurs depuis D-037. Une écriture qui perd la course est
   rejouée sur la version fraîche ; si elle échoue encore, 500, et Stripe
   réessaie. Jamais d'écriture à l'aveugle qui écraserait un virement, un
   remboursement ou un changement de statut concurrent.

   Réponse 2xx dès que l'événement est traité ou sans objet ; 4xx/5xx
   seulement quand on veut que Stripe réessaie. */
import type { Config } from "@netlify/functions";
import type Stripe from "stripe";
import { store, json, pushNotif, sha256 } from "./_shared/core.mts";
import { stripe } from "./_shared/stripe.mts";
import { applyTransition, patchOrder } from "./_shared/order-core.mts";
import { alerterAdmins } from "./_shared/admin-alert.mts";
import { onOrderPaid, type OrderPaye } from "./_shared/order-paid.mts";

const orderIdOf = (session: Stripe.Checkout.Session): string =>
  session.metadata?.orderId ?? session.client_reference_id ?? "";

async function payer(recu: Stripe.Checkout.Session) {
  /* DÉFENSE EN PROFONDEUR : on ne croit pas le contenu du message, même
     signé. On relit la session DIRECTEMENT chez Stripe, avec la clé d'API.
     Si le secret de signature fuitait un jour (il est lisible dans
     l'interface Netlify du projet), un faux « paiement réussi » ne
     suffirait donc pas à faire expédier une pièce : il faudrait que Stripe
     lui-même confirme que l'argent est passé, et que le montant soit bien
     celui de la commande. */
  const session = await stripe()!.checkout.sessions.retrieve(recu.id);
  if (session.payment_status !== "paid") return;
  const orderId = orderIdOf(session);
  if (!orderId) return;
  const orders = store("orders");
  const avant = (await orders.get(`o:${orderId}`, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!avant) return;
  if (
    typeof avant.totalCents === "number" &&
    session.amount_total !== avant.totalCents
  ) {
    console.error(
      "webhook_montant_incoherent",
      orderId,
      session.amount_total,
      avant.totalCents,
    );
    return;
  }

  // rattache le paiement AVANT la transition : c'est lui qui permettra de
  // rembourser plus tard
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (pi && avant.paymentIntentId !== pi) {
    const w = await patchOrder(orderId, (fresh) =>
      fresh.paymentIntentId === pi ? null : { ...fresh, paymentIntentId: pi },
    );
    if (!w.ok && w.reason === "conflict")
      throw new Error(`paymentIntentId non écrit sur ${orderId} (conflit)`);
    if (!w.ok) return;
  }

  const r = await applyTransition({
    orderId,
    action: "pay",
    role: "system",
    by: "stripe",
    note: "Paiement confirmé par Stripe",
  });
  if (!r.ok) return; // déjà payée (rejeu) ou plus en attente : rien à refaire

  await onOrderPaid(r.order as unknown as OrderPaye);
  await pushNotif(r.order.buyerId, {
    type: "order",
    text: `Paiement confirmé — ${r.order.brand} ${r.order.name}. Le vendeur a 3 jours pour expédier.`,
    link: `/commande/${orderId}`,
  });
}

async function expirer(recu: Stripe.Checkout.Session, motif: string) {
  // même règle : un faux « expiré » ne doit pas annuler un achat en cours
  const session = await stripe()!.checkout.sessions.retrieve(recu.id);
  const vraimentPerdu =
    session.status === "expired" ||
    (session.status === "complete" && session.payment_status === "unpaid");
  if (!vraimentPerdu) return;
  const orderId = orderIdOf(session);
  if (!orderId) return;
  await applyTransition({
    orderId,
    action: "expire",
    role: "system",
    by: "stripe",
    note: motif,
  });
}

/** Contestation relue chez Stripe, et la commande qu'elle vise. */
async function contestationEtCommande(
  recu: Stripe.Dispute,
): Promise<{ dispute: Stripe.Dispute; orderId: string } | null> {
  const s = stripe()!;
  const dispute = await s.disputes.retrieve(recu.id);
  const pi =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? "");
  if (!pi) return null;
  const intent = await s.paymentIntents.retrieve(pi);
  const orderId = intent.metadata?.orderId;
  return orderId ? { dispute, orderId } : null;
}

/** Écriture conditionnelle ; un conflit persistant remonte en 500 pour
    que Stripe rejoue l'événement. Commande introuvable : false. */
async function ecrireCommande(
  orderId: string,
  fn: Parameters<typeof patchOrder>[1],
): Promise<boolean> {
  const w = await patchOrder(orderId, fn);
  if (!w.ok && w.reason === "conflict")
    throw new Error(`commande ${orderId} non écrite (conflit)`);
  return w.ok;
}

/* Contestation bancaire : l'argent est débité du solde SOLANGE par Stripe
   (destination charge). On ne change pas l'état de la commande — c'est
   une procédure bancaire, pas un litige SOLANGE — mais on la marque (ce
   qui suspend le virement au vendeur, D-037) et on prévient les
   administrateurs, qui ont un délai court pour répondre. Un rejeu du même
   événement garde la date d'origine. */
async function contestation(recu: Stripe.Dispute) {
  const found = await contestationEtCommande(recu);
  if (!found) return;
  const { dispute, orderId } = found;
  const ecrit = await ecrireCommande(orderId, (fresh) =>
    fresh.bankDispute?.id === dispute.id
      ? null
      : {
          ...fresh,
          bankDispute: {
            id: dispute.id,
            reason: dispute.reason,
            amount: dispute.amount,
            at: Date.now(),
          },
        },
  );
  if (!ecrit) return;
  const users = store("users");
  for (const raw of (process.env.ADMIN_EMAILS ?? "").split(",")) {
    const mail = raw.trim().toLowerCase();
    if (!mail) continue;
    const uid = (await users.get(`email:${sha256(mail)}`, { type: "text" })) as
      string | null;
    if (uid)
      await pushNotif(uid, {
        type: "report",
        text: `Contestation bancaire sur la commande ${orderId} — à traiter dans le tableau de bord Stripe`,
        link: `/commande/${orderId}`,
      });
  }
}

/* Contestation close (charge.dispute.closed). Gagnée (`won`), ou simple
   demande d'information close sans litige (`warning_closed`) : la
   contestation n'est plus « en cours » (CGV art. 12.7), elle est archivée
   et le virement au vendeur reprend son cours au prochain passage du
   cron (vérifié dans la doc Stripe : `warning_closed` clôt une demande
   d'information sans chargeback). Perdue (`lost`), ou toute autre issue
   (`prevented` : résolue — souvent par un remboursement de l'acheteur —
   ou bloquée avant le chargeback, selon le programme de prévention) : le
   virement reste suspendu, et l'équipe décide. */
const CONTESTATION_LEVEE = new Set(["won", "warning_closed"]);

async function contestationClose(recu: Stripe.Dispute) {
  const found = await contestationEtCommande(recu);
  if (!found) return;
  const { dispute, orderId } = found;
  const levee = CONTESTATION_LEVEE.has(dispute.status);
  const now = Date.now();
  // rejeu de l'événement : rien à réécrire, personne à re-prévenir
  const etat = { change: false };
  const ecrit = await ecrireCommande(orderId, (fresh) => {
    const bd = fresh.bankDispute;
    etat.change = false;
    if (!bd || bd.id !== dispute.id || bd.closedAt) return null;
    etat.change = true;
    const close = { ...bd, status: dispute.status, closedAt: now };
    if (!levee) return { ...fresh, bankDispute: close };
    const { bankDispute: ancienne, ...reste } = fresh;
    void ancienne;
    return { ...reste, bankDisputeClosed: close };
  });
  if (!ecrit || !etat.change) return;
  await alerterAdmins({
    text: levee
      ? `Contestation bancaire close en faveur du vendeur — commande ${orderId} : le virement au vendeur reprend automatiquement`
      : `Contestation bancaire perdue (${dispute.status}) — commande ${orderId} : ${dispute.status === "lost" ? "la banque a rendu la somme à l'acheteur" : "issue à vérifier dans le Dashboard Stripe"}. Virement au vendeur suspendu : décider de reprendre sa part (Dashboard Stripe) ou de verser malgré tout (/admin)`,
    link: "/admin",
    subject: levee ? undefined : "SOLANGE — contestation bancaire perdue",
  });
}

export default async (req: Request) => {
  if (req.method !== "POST")
    return json({ error: "Méthode non autorisée" }, 405);
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!s || !secret)
    return json(
      { error: "Webhook non configuré — paiements réels non activés" },
      501,
    );

  const signature = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text(); // BRUT — jamais parsé avant vérification
  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(raw, signature, secret);
  } catch {
    // signature invalide : on ne dit rien de plus, et Stripe ne réessaiera
    // pas un événement qu'il n'a pas émis
    return json({ error: "Signature invalide" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // carte : payé tout de suite. Moyens asynchrones : on attend
        // async_payment_succeeded.
        if (session.payment_status === "paid") await payer(session);
        break;
      }
      case "checkout.session.async_payment_succeeded":
        await payer(event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await expirer(event.data.object, "Paiement refusé par la banque");
        break;
      case "checkout.session.expired":
        await expirer(event.data.object, "Paiement non finalisé dans le délai");
        break;
      case "charge.dispute.created":
        await contestation(event.data.object);
        break;
      case "charge.dispute.closed":
        await contestationClose(event.data.object);
        break;
      default:
        // événement non écouté : 200, sinon Stripe le rejouerait pour rien
        break;
    }
  } catch (e) {
    // erreur de NOTRE côté : 500 pour que Stripe réessaie plus tard
    console.error("webhook_error", event.type, (e as Error).message);
    return json({ error: "Traitement impossible, réessayer" }, 500);
  }

  return json({ received: true });
};

export const config: Config = { path: "/api/payment/webhook" };
