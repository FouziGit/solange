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

const BUSY_STATES = /\b(?:photoBusy|submitting|addBlocked|busy)\b/;

function source(file: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../${file}`, import.meta.url)),
    "utf8",
  );
}

// `disabled={…}` seul — pas `aria-disabled={…}`
function disabledExpressions(file: string): string[] {
  return [...source(file).matchAll(/(?<![-\w])disabled=\{([^}]*)\}/g)].map(
    (m) => m[1],
  );
}

function ariaDisabledExpressions(file: string): string[] {
  return [...source(file).matchAll(/aria-disabled=\{([^}]*)\}/g)].map(
    (m) => m[1],
  );
}

describe("focus conservé pendant un traitement", () => {
  for (const page of ["vendre", "creer", "profil"]) {
    it(`/${page} : aucun bouton disabled par un traitement en cours`, () => {
      const exprs = disabledExpressions(`app/${page}/page.tsx`);
      expect(exprs.length).toBeGreaterThan(0); // le motif lit bien le fichier
      for (const e of exprs) expect(e).not.toMatch(BUSY_STATES);
    });
  }

  /* Les feuilles du profil n'ont aucun `disabled` : leur traitement passe
     entièrement par aria-disabled, ce qu'on vérifie dans l'autre sens. */
  for (const sheet of ["AvatarSheet", "HandleSheet"]) {
    it(`${sheet} : le traitement en cours passe par aria-disabled`, () => {
      const file = `components/profile/${sheet}.tsx`;
      for (const e of disabledExpressions(file))
        expect(e).not.toMatch(BUSY_STATES);
      const aria = ariaDisabledExpressions(file);
      expect(aria.length).toBeGreaterThan(0);
      for (const e of aria) expect(e).toMatch(BUSY_STATES);
    });
  }
});
