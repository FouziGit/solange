/* ============================================================
   SOLANGE — catégories et états d'une pièce.

   Ces deux listes vivaient dans src/lib/mock.ts, au milieu du contenu de
   démonstration. Ce sont pourtant des données de PRODUIT : elles décrivent
   ce qu'on peut vendre, pas ce qu'on affiche en vitrine. Elles restent donc
   quand la démonstration s'en va.
   ============================================================ */

export const categories = [
  "Tout",
  "Femme",
  "Homme",
  "Parfum",
  "Archive",
  "Streetwear",
  "Luxe",
  "Sneakers",
  "Accessoires",
] as const;

export type Categorie = (typeof categories)[number];

/** L'univers de marques pertinent pour une catégorie. Sert à ne pas
    proposer Guerlain à quelqu'un qui dépose une paire de sneakers. */
export function universDe(categorie: string): "mode" | "parfum" | undefined {
  return categorie === "Parfum"
    ? "parfum"
    : categorie === "Tout"
      ? undefined
      : "mode";
}

export const conditions = [
  "Neuf avec étiquette",
  "Excellent état",
  "Très bon état",
  "Bon état",
] as const;
