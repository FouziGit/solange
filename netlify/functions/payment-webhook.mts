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

   Réponse 2xx dès que l'événement est traité ou sans objet ; 4xx/5xx
   seulement quand on veut que Stripe réessaie. */
import type { Config } from "@netlify/functions";
import type Stripe from "stripe";
import { store, json, pushNotif, sha256 } from "./_shared/core.mts";
import { stripe } from "./_shared/stripe.mts";
import { applyTransition } from "./_shared/order-core.mts";
import { onOrderPaid, type OrderPaye } from "./_shared/order-paid.mts";

const orderIdOf = (session: Stripe.Checkout.Session): string =>
  session.metadata?.orderId ?? session.client_reference_id ?? "";

async function payer(session: Stripe.Checkout.Session) {
  const orderId = orderIdOf(session);
  if (!orderId) return;
  const orders = store("orders");
  const avant = (await orders.get(`o:${orderId}`, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!avant) return;

  // rattache le paiement AVANT la transition : c'est lui qui permettra de
  // rembourser plus tard
  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (pi && avant.paymentIntentId !== pi)
    await orders.setJSON(`o:${orderId}`, { ...avant, paymentIntentId: pi });

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

async function expirer(session: Stripe.Checkout.Session, motif: string) {
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

/* Contestation bancaire : l'argent est débité du solde SOLANGE par Stripe
   (destination charge). On ne change pas l'état de la commande — c'est
   une procédure bancaire, pas un litige SOLANGE — mais on la marque et on
   prévient les administrateurs, qui ont un délai court pour répondre. */
async function contestation(dispute: Stripe.Dispute) {
  const pi =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? "");
  if (!pi) return;
  const s = stripe()!;
  const intent = await s.paymentIntents.retrieve(pi);
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;
  const orders = store("orders");
  const o = (await orders.get(`o:${orderId}`, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!o) return;
  await orders.setJSON(`o:${orderId}`, {
    ...o,
    bankDispute: {
      id: dispute.id,
      reason: dispute.reason,
      amount: dispute.amount,
      at: Date.now(),
    },
  });
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
