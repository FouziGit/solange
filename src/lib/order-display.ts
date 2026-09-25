/* ============================================================
   SOLANGE — affichage d'une commande (logique pure, testée dans
   src/lib/__tests__/order-display.test.ts).
   - stepState : place d'une étape dans la frise de /commande/[id],
     pour la dire aussi aux lecteurs d'écran (aria-current="step").
   - paymentNote : mention de paiement d'une commande dans /profil.
   ============================================================ */

import { TIMELINE, type OrderStatus } from "./order-state";
import type { PaymentsMode } from "./use-payments-mode";

export type StepState = "franchie" | "actuelle" | "a_venir";

/** Étape de la frise payée → expédiée → reçue → terminée, vue depuis le
    statut de la commande. Annulée ou en litige : la frise s'arrête, rien
    n'y est acquis. En attente de paiement : tout reste à venir. */
export function stepState(status: OrderStatus, step: OrderStatus): StepState {
  if (status === "annulee" || status === "litige") return "a_venir";
  const idx = TIMELINE.indexOf(status);
  const i = TIMELINE.indexOf(step);
  if (idx < 0 || i < 0 || i > idx) return "a_venir";
  return i === idx ? "actuelle" : "franchie";
}

/** « carte •••• 4242 » quand on connaît la carte. Sinon, « paiement
    simulé » SEULEMENT si le serveur a dit que le paiement réel est coupé :
    en production il est actif, et la commande a été payée pour de vrai.
    Tant qu'on ne sait pas (chargement, hors ligne), on ne dit rien. */
export function paymentNote(
  last4: string,
  mode: Pick<PaymentsMode, "ready" | "live">,
): string | null {
  if (/^\d{4}$/.test(last4)) return `carte •••• ${last4}`;
  return mode.ready && !mode.live ? "paiement simulé (démo)" : null;
}
