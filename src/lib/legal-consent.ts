/* ============================================================
   SOLANGE — preuve d'acceptation des conditions.
   Aujourd'hui, RIEN n'est accepté nulle part dans le produit : en cas
   de litige, l'exploitant ne peut pas démontrer que ses conditions
   étaient opposables. Ce module est la réponse.

   Règle : la version enregistrée est TOUJOURS celle du serveur. Le
   client dit « j'accepte », il ne dit pas « j'accepte la version 7 » —
   sinon il suffirait d'envoyer un grand nombre pour ne plus jamais
   revoir l'écran de réacceptation.
   ============================================================ */

import { LEGAL_VERSION } from "./legal";

export type LegalConsent = {
  /** version du socle acceptée — celle du serveur au moment du clic */
  version: number;
  /** horodatage de l'acceptation (ms epoch) */
  at: number;
  /** déclaration d'âge minimum faite au même moment */
  age: boolean;
};

/** Ce que le client doit envoyer pour qu'une acceptation soit prise en
    compte. Les deux cases sont distinctes et toutes deux obligatoires :
    accepter les conditions n'est pas déclarer son âge. */
export function acceptancePayloadIsValid(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.acceptLegal === true && b.ageDeclared === true;
}

/** Construit l'enregistrement à stocker. `now` est injecté pour rester
    testable. */
export function buildConsent(now: number): LegalConsent {
  return { version: LEGAL_VERSION, at: now, age: true };
}

/** Vrai si la personne doit (ré)accepter avant de continuer :
    - elle n'a jamais rien accepté (cas de tous les comptes existants) ;
    - ou le socle a changé depuis son acceptation. */
export function needsAcceptance(
  consent: LegalConsent | null | undefined,
  currentVersion: number = LEGAL_VERSION,
): boolean {
  if (!consent || typeof consent.version !== "number") return true;
  return consent.version < currentVersion;
}

/** Acceptation des CGV au moment d'une commande. Distincte de
    l'acceptation du socle : elle est propre à CETTE vente et vit sur la
    commande, ce qui la rend opposable même si les CGV changent ensuite. */
export type SaleConsent = { version: number; at: number };

export function saleAcceptanceIsValid(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return (body as Record<string, unknown>).acceptCgv === true;
}

export function buildSaleConsent(now: number): SaleConsent {
  return { version: LEGAL_VERSION, at: now };
}

/** Distingue la première acceptation d'une réacceptation : le texte
    affiché n'est pas le même, et mentir sur ce point serait gratuit. */
export function acceptanceKind(
  consent: LegalConsent | null | undefined,
): "first" | "update" {
  return consent && typeof consent.version === "number" ? "update" : "first";
}
