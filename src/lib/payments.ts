/* ============================================================
   SOLANGE — règles d'argent du paiement réel. Fonctions PURES.

   Tout ce qui décide d'un montant est ici, en centimes entiers, testé.
   Les fonctions Netlify ne font qu'appeler Stripe avec ce qu'on calcule
   ici — elles ne recalculent rien.
   ============================================================ */

import { splitFee } from "./fees";

export type Montants = {
  /** Ce que paie l'acheteur. */
  totalCents: number;
  /** Ce que garde SOLANGE : commission vendeur + frais de service acheteur.
      C'est l'application_fee_amount de la destination charge. */
  applicationFeeCents: number;
  /** Ce qui arrive sur le compte Stripe du vendeur : prix − commission +
      frais de port (c'est lui qui expédie, donc lui qui les paie). */
  sellerCents: number;
  /** Détail, pour l'affichage et le relevé. */
  commissionCents: number;
  serviceCents: number;
  shippingCents: number;
  priceCents: number;
  rateBps: number;
};

/** Frais de service acheteur (« protection acheteur ») : 5 % du prix.
    Ils existaient déjà dans le parcours simulé et n'étaient décrits nulle
    part dans les CGV ; ils le sont désormais (art. 5). */
export const SERVICE_BPS = 500;

export function montants(
  priceCents: number,
  shippingCents: number,
  rateBpsGele?: number,
): Montants {
  const price = Math.max(0, Math.trunc(priceCents));
  const shipping = Math.max(0, Math.trunc(shippingCents));
  const { feeCents: commission, rateBps } = splitFee(price, rateBpsGele);
  const service = Math.round((price * SERVICE_BPS) / 10_000);
  const total = price + service + shipping;
  const applicationFee = commission + service;
  return {
    totalCents: total,
    applicationFeeCents: applicationFee,
    sellerCents: total - applicationFee,
    commissionCents: commission,
    serviceCents: service,
    shippingCents: shipping,
    priceCents: price,
    rateBps,
  };
}

/** Un vendeur peut-il recevoir une destination charge ? Il faut que sa
    capacité `transfers` soit ACTIVE : sans elle, Stripe refuse le
    paiement. On ne regarde pas `payouts_enabled` : un vendeur peut
    recevoir l'argent sur son solde Stripe avant d'avoir branché sa banque,
    il le récupérera ensuite. */
/** Prix maximum d'une annonce, en euros.

    Déclaré à Stripe lors de l'activation de Connect : « le produit le plus
    cher vendu sur la plateforme coûte moins de 10 000 $ ». La déclaration
    engage : une vente au-dessus peut faire suspendre le compte en pleine
    transaction. 8 000 € et non 9 000 € : au taux de change de 2026, 9 000 €
    peuvent dépasser 10 000 $. 8 000 € restent en dessous quel que soit le
    cours.

    C'est aussi une protection : la plateforme répond des fraudes
    (losses.payments = application). Un plafond borne ce qu'une carte volée
    peut coûter d'un coup. À relever — ET À REDÉCLARER À STRIPE — quand
    l'historique le permettra. */
export const PRIX_MAX_EUR = 8_000;

export function sellerPayable(
  acct: {
    capabilities?: { transfers?: string | null } | null;
  } | null,
): boolean {
  return acct?.capabilities?.transfers === "active";
}
