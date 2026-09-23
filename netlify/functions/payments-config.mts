/* GET /api/payments/config — le navigateur doit savoir si le paiement est
   réel, pour ne pas afficher la fausse carte de démonstration à quelqu'un
   qui va payer pour de vrai, et inversement. Ne révèle rien de la clé :
   seulement si elle est posée, et si c'est une clé de test. */
import type { Config } from "@netlify/functions";
import { json } from "./_shared/core.mts";
import { stripeMode } from "./_shared/stripe.mts";

export default async () => {
  const mode = stripeMode();
  return json({ live: mode !== "off", test: mode === "test" });
};

export const config: Config = { path: "/api/payments/config" };
