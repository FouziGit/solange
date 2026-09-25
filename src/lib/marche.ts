/* ============================================================
   SOLANGE — Marché (/decouvrir) : textes lus par VoiceOver.
   Règles PURES, testées dans src/lib/__tests__/marche.test.ts.
   ============================================================ */

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Bilan d'une recherche ou d'un filtre, annoncé après la frappe :
 * « 12 pièces, 3 profils, 1 contenu » ou « Aucune pièce ne correspond ».
 * Profils et contenus ne comptent que s'il y a une recherche (`profiles`
 * et `content` à null sinon), comme les onglets.
 */
export function resultatsMarche({
  pieces,
  profiles = null,
  content = null,
  invertedRange = false,
}: {
  pieces: number;
  profiles?: number | null;
  content?: number | null;
  invertedRange?: boolean;
}): string {
  const autres = [
    profiles != null && pluriel(profiles, "profil"),
    content != null && pluriel(content, "contenu"),
  ].filter(Boolean);
  if (pieces > 0) return [pluriel(pieces, "pièce"), ...autres].join(", ");
  const aucune = invertedRange
    ? "Aucune pièce : ton prix minimum dépasse ton maximum"
    : "Aucune pièce ne correspond";
  return autres.length ? `${aucune}. ${autres.join(", ")}` : aucune;
}

/** Nom du bouton Filtres : le nombre de filtres actifs y est dit, pas
    seulement dessiné dans la pastille. */
export function filtresLabel(actifs: number): string {
  return actifs > 0
    ? `Filtres avancés (pièces), ${actifs} actif${actifs > 1 ? "s" : ""}`
    : "Filtres avancés (pièces)";
}
