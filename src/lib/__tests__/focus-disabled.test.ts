import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Un bouton qui a le focus ne doit pas devenir `disabled` à cause du
   traitement qu'il vient de lancer : le navigateur renvoie alors le focus
   sur <body>, et le clavier (ou VoiceOver) repart du haut de la page.
   C'est ce qui arrivait à chaque photo ajoutée sur /vendre et /creer, et
   à « Mettre en vente » quand la publication échouait. Ces boutons passent
   par aria-disabled + une garde dans le gestionnaire.

   Pas de DOM dans la suite : on lit les vrais fichiers et on vérifie
   qu'aucun `disabled={…}` n'y dépend d'un état de traitement. */

const BUSY_STATES = /\b(?:photoBusy|submitting|addBlocked)\b/;

function disabledExpressions(page: string): string[] {
  const src = readFileSync(
    fileURLToPath(new URL(`../../app/${page}/page.tsx`, import.meta.url)),
    "utf8",
  );
  // `disabled={…}` seul — pas `aria-disabled={…}`
  return [...src.matchAll(/(?<![-\w])disabled=\{([^}]*)\}/g)].map((m) => m[1]);
}

describe("focus conservé pendant un traitement", () => {
  for (const page of ["vendre", "creer"]) {
    it(`/${page} : aucun bouton disabled par un traitement en cours`, () => {
      const exprs = disabledExpressions(page);
      expect(exprs.length).toBeGreaterThan(0); // le motif lit bien le fichier
      for (const e of exprs) expect(e).not.toMatch(BUSY_STATES);
    });
  }
});
