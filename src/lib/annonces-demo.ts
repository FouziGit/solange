/* ============================================================
   SOLANGE — annonces de démonstration (vraies photos).

   Trois pièces réelles, photographiées, mises en vente par trois profils
   fictifs : de quoi voir le Marché, la fiche article et le profil
   vendeur en conditions réelles. Branchées dans `catalog` UNIQUEMENT
   quand NEXT_PUBLIC_DEMO_ANNONCES=1 à la construction : la production
   reste vide de tout contenu fictif (V1, 23/09).
   ============================================================ */

import type { CatalogItem } from "./mock";

export type VendeurDemo = {
  handle: string;
  name: string;
  seed: string;
  followers: number;
  verified: boolean;
};

export const VENDEURS_DEMO: VendeurDemo[] = [
  {
    handle: "leo.vestiaire",
    name: "Léo M.",
    seed: "leo-vestiaire",
    followers: 412,
    verified: true,
  },
  {
    handle: "ines.archive",
    name: "Inès",
    seed: "ines-archive",
    followers: 1280,
    verified: true,
  },
  {
    handle: "samy.mmm",
    name: "Samy",
    seed: "samy-mmm",
    followers: 236,
    verified: false,
  },
];

const img = (slug: string) =>
  [1, 2, 3].map((n) => `/img/annonces/${slug}-${n}.jpg`);

export const ANNONCES_DEMO: CatalogItem[] = [
  {
    id: "gucci-horsebit-1953-marron",
    brand: "Gucci",
    name: "Mocassins Horsebit 1953",
    priceEUR: 290,
    originalEUR: 890,
    size: "43",
    condition: "Bon état",
    category: "Luxe",
    seed: "gucci-horsebit-1953",
    seller: "leo.vestiaire",
    likes: 38,
    images: img("gucci-1953"),
    color: "Marron cognac",
    material: "Cuir de veau, semelle cuir",
    postedAgo: "il y a 2 jours",
    description: `Le mocassin Horsebit 1953 de Gucci, en cuir marron patiné. Le mors est en métal doré, il n'a ni rayure ni oxydation.

Taille 9 Gucci, soit un 43. Le modèle chausse normal, je fais du 43 partout.

Portés une saison, puis restés dans leurs housses. La semelle cuir a de l'usure normale (voir photo) mais encore beaucoup de vie, le talon a été refait chez un cordonnier. L'intérieur est propre, l'étiquette bien lisible.

Vendus avec leurs deux housses d'origine. Envoi soigné sous 48 h, en point relais ou en main propre sur Paris 11e.`,
  },
  {
    id: "stone-island-gilet-metal-lamina",
    brand: "Stone Island",
    name: "Gilet Metal Lamina Poly Ripstop",
    priceEUR: 185,
    originalEUR: 495,
    size: "L",
    condition: "Excellent état",
    category: "Streetwear",
    seed: "stone-island-metal-lamina",
    seller: "ines.archive",
    likes: 64,
    images: img("stone-island-gilet"),
    color: "Bleu marine",
    material: "Polyester ripstop laminé aluminium",
    postedAgo: "il y a 5 heures",
    description: `Gilet Stone Island en Metal Lamina Poly Ripstop, de la ligne Engineering. Micro ripstop polyester, laminé aluminium à l'intérieur (la doublure argentée qu'on voit sur la 2e photo). Coupe-vent, déperlant, et il tient vraiment chaud pour un sans-manches.

Taille L, coupe droite. Il va aussi à un M qui veut le porter par-dessus un sweat.

Porté une dizaine de fois, aucun défaut. Les zips fonctionnent parfaitement, le badge est cousu et amovible, le col en maille est intact.

Je l'envoie plié avec soin, en point relais.`,
  },
  {
    id: "maison-margiela-track-jacket-bleu",
    brand: "Maison Margiela",
    name: "Veste de survêtement déconstruite",
    priceEUR: 240,
    originalEUR: 790,
    size: "M",
    condition: "Très bon état",
    category: "Archive",
    seed: "margiela-track-jacket",
    seller: "samy.mmm",
    likes: 21,
    images: img("margiela-track"),
    color: "Bleu roi et noir",
    material: "Jersey technique, côtes",
    postedAgo: "hier",
    description: `Veste zippée Maison Margiela de la ligne 10 (le chiffre entouré sur l'étiquette). Bleu roi avec empiècements noirs aux épaules. Les coutures sont apparentes et les bords laissés bruts, c'est la construction Margiela : ce n'est pas un défaut.

Taille 48 IT, soit un M. Coupe légèrement ample.

Très bon état. Quelques petites bouloches sous les bras, à peine visibles. Zips blancs impeccables. Les quatre points blancs au dos sont bien là.

Fabriquée en Italie. Sérieux uniquement, je réponds vite. Envoi suivi.`,
  },
];
