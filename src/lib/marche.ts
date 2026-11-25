/* ============================================================
   SOLANGE — Marché (/decouvrir) : textes lus par VoiceOver et marques
   proposées au filtre.
   Règles PURES, testées dans src/lib/__tests__/marche.test.ts.
   ============================================================ */

/* Exporté : l'étiquette (nPieces) accorde avec la même règle. */
export const pluriel = (n: number, mot: string) =>
  `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Bilan d'une recherche ou d'un filtre, annoncé après la frappe :
 * « 12 pièces, 3 membres, 1 look » ou « Aucune pièce ne correspond ».
 * Membres et looks ne comptent que s'il y a une recherche (`profiles` et
 * `content` à null sinon), comme les onglets. `content` ne compte que des
 * looks : le Journal ne fait pas partie de cette recherche.
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
    profiles != null && pluriel(profiles, "membre"),
    content != null && pluriel(content, "look"),
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

/** Marques proposées d'emblée au filtre : celles qui ont une pièce en vente,
    sans doublon, triées en français. Filtrer sur une marque sans pièce ne
    rend jamais rien. Une pièce de démonstration n'a pas de `status` : elle
    est en vente. */
export function marquesEnVente(
  pieces: readonly { brand: string; status?: string }[],
): string[] {
  const enVente = pieces.filter(
    (p) => p.brand.trim() && (p.status ?? "available") === "available",
  );
  return [...new Set(enVente.map((p) => p.brand))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}
