/* ============================================================
   SOLANGE — accès Stripe côté serveur. POINT D'ENTRÉE UNIQUE.

   LE DRAPEAU, C'EST LA PRÉSENCE DE LA CLÉ (même règle que le push, D-023).
   Sans STRIPE_SECRET_KEY, `stripe()` renvoie null et tout le parcours
   retombe sur le paiement simulé. Déployer ce code ne change donc RIEN
   tant que la clé n'est pas posée dans Netlify — c'est ce qui permet de
   livrer avant d'activer.

   La clé ne transite jamais ailleurs que par la variable d'environnement.
   Elle n'est ni journalisée, ni renvoyée, ni dérivée.

   MONTAGE : destination charges (docs.stripe.com/connect/destination-charges).
   L'acheteur paie sur le compte plateforme ; la part du vendeur part
   IMMÉDIATEMENT sur son compte connecté Stripe ; la commission SOLANGE est
   prélevée au passage via application_fee_amount. La plateforme ne retient
   jamais l'argent du vendeur : c'est le choix qui évite de faire de SOLANGE
   un intermédiaire qui détient des fonds pour autrui.
   ============================================================ */
import Stripe from "stripe";

let client: Stripe | null | undefined;

/** Client Stripe, ou null si les paiements réels ne sont pas activés. */
export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  client = key ? new Stripe(key, { maxNetworkRetries: 2 }) : null;
  return client;
}

/** Paiements réels activés ? Lu par /api/payments/config et par /api/orders. */
export function paymentsLive(): boolean {
  return stripe() !== null;
}

/** Mode de la clé posée : test ou live. Ne révèle rien d'autre de la clé. */
export function stripeMode(): "test" | "live" | "off" {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "off";
  return key.startsWith("sk_live_") || key.startsWith("rk_live_")
    ? "live"
    : "test";
}

export type Remboursement =
  { ok: true; refundId: string } | { ok: false; error: string };

/** Rembourse intégralement une commande payée par Stripe.

    - reverse_transfer : reprend la part du vendeur sur son compte Stripe ;
    - refund_application_fee : rend aussi la commission, sans quoi
      l'acheteur est remboursé mais SOLANGE garde sa part d'une vente
      annulée (la doc impose d'ailleurs le reverse_transfer dans ce cas).
    - clé d'idempotence par commande : rejouer n'émet jamais deux
      remboursements.

    Si la part du vendeur est déjà partie vers sa banque, Stripe REFUSE la
    requête (il ne la met pas en attente). On renvoie alors l'erreur telle
    quelle : la commande ne change pas d'état, et un administrateur tranche
    — rembourser depuis le solde SOLANGE est une décision d'argent, pas un
    automatisme. */
export async function rembourser(order: {
  id: string;
  paymentIntentId?: unknown;
}): Promise<Remboursement> {
  const s = stripe();
  if (!s) return { ok: false, error: "Paiements réels non activés" };
  const pi =
    typeof order.paymentIntentId === "string" ? order.paymentIntentId : "";
  if (!pi)
    return { ok: false, error: "Paiement Stripe introuvable sur la commande" };
  try {
    const r = await s.refunds.create(
      {
        payment_intent: pi,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: `refund-${order.id}` },
    );
    return { ok: true, refundId: r.id };
  } catch (e) {
    console.error("refund_error", order.id, (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}
