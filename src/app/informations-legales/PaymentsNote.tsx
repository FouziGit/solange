"use client";

import { paymentsClaim } from "@/lib/legal";
import { usePaymentsMode } from "@/lib/use-payments-mode";

/** La phrase sur le paiement, selon /api/payments/config. Client : la
    page reste un composant serveur. Rien tant que le serveur n'a pas
    répondu : on n'affirme pas « simulé » à quelqu'un qui paie pour de
    vrai. */
export function PaymentsNote() {
  const claim = paymentsClaim(usePaymentsMode());
  if (claim === "simule")
    return (
      <>
        Le service fonctionne en version d&apos;essai : les paiements y sont
        simulés, aucune somme n&apos;est débitée et aucune vente n&apos;est
        réellement conclue.
      </>
    );
  if (claim === "stripe")
    return <>Le paiement se fait par carte, via Stripe.</>;
  return null;
}
