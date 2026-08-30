/* /api/payment/webhook — STUB (lot 1).
   Réservé au futur PSP réel : il confirmera ici les paiements
   asynchrones (créée → payée). Tant que le paiement est simulé,
   l'endpoint existe mais refuse tout. */
import type { Config } from "@netlify/functions";
import { bad } from "./_shared/core.mts";

export default async () =>
  bad("Webhook non configuré — paiement simulé en beta", 501);

export const config: Config = { path: "/api/payment/webhook" };
