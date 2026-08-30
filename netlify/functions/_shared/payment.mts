/* Point d'entrée paiement UNIQUE (lot 1).
   Beta : paiement SIMULÉ — capture immédiate, aucune donnée bancaire ne
   transite jamais. Quand un vrai PSP arrivera (décision business, hors
   périmètre), SEUL ce module change : capturePayment ouvrira une session
   de paiement et c'est le webhook (payment-webhook.mts) qui fera passer
   la commande à « payée ». */

export type PaymentResult =
  { ok: true; reference: string } | { ok: false; error: string };

export async function capturePayment(order: {
  id: string;
  totalEUR: number;
  buyerId: string;
}): Promise<PaymentResult> {
  // Simulation : capture immédiate, référence traçable dans l'historique.
  return { ok: true, reference: `sim_${order.id}` };
}
