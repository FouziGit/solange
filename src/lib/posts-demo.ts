/* ============================================================
   SOLANGE — publications de démonstration (fil Looks).

   Quatre posts de créateurs mode fictifs, sur de vrais médias : deux
   carrousels à faire glisser, deux vidéos. Rien à vendre : ce sont des
   créateurs qui parlent de mode. Branchés dans `looks` UNIQUEMENT quand
   NEXT_PUBLIC_DEMO_ANNONCES=1 à la construction (démo locale).

   Médias : /public/img/posts (carrousels), /public/video/<id>.mp4 et
   .jpg (vidéo H.264 + image d'attente), /public/img/looks/<id>.jpg.
   ============================================================ */

import type { Creator, Look } from "./mock";

const camille: Creator = {
  id: "demo-camille",
  handle: "camille.runway",
  name: "Camille Roux",
  seed: "camille-runway",
  followers: 48200,
  verified: true,
};

const yanis: Creator = {
  id: "demo-yanis",
  handle: "yanis.streetnotes",
  name: "Yanis B.",
  seed: "yanis-streetnotes",
  followers: 23600,
};

const karim: Creator = {
  id: "demo-karim",
  handle: "karim.kicks",
  name: "Karim",
  seed: "karim-kicks",
  followers: 61400,
  verified: true,
};

const lea: Creator = {
  id: "demo-lea",
  handle: "lea.details",
  name: "Léa Marchetti",
  seed: "lea-details",
  followers: 112000,
  verified: true,
};

const posts = (slug: string, n: number) =>
  Array.from({ length: n }, (_, i) => `/img/posts/${slug}-${i + 1}.jpg`);

export const POSTS_DEMO: Look[] = [
  {
    id: "post-jil-sander-ss27",
    creator: camille,
    title: "Minimal",
    caption:
      "Jil Sander SS27, ou comment faire du minimalisme sans s'ennuyer. La veste croisée qui tombe en drapé, le pantalon gris à pinces, le sac en cuir porté bas. Rien de trop, tout est juste. Le trench gris perle avec les derbies rouges, c'est ma pièce préférée du défilé. Swipe →",
    location: "Milan",
    tags: ["#jilsander", "#ss27", "#minimalisme", "#runway"],
    seed: "jil-sander-ss27",
    likes: 5770,
    comments: 24,
    shares: 312,
    products: [],
    soundtrack: "son original — camille.runway",
    badge: "DÉFILÉ",
    brandTags: ["Jil Sander"],
    gallery: posts("jil-sander-ss27", 4),
  },
  {
    id: "post-supreme-martine-rose",
    creator: yanis,
    title: "Patchs",
    caption:
      "Supreme × Martine Rose, le hoodie Mike Tyson couvert de patchs. Le drapeau qui a changé sur le patch central fait beaucoup parler, mais regardez la quantité de détails brodés partout ailleurs. Collab la plus folle de la saison ou pas ? Vous le prenez ?",
    location: "Londres",
    tags: ["#supreme", "#martinerose", "#collab", "#streetwear"],
    seed: "supreme-martine-rose",
    likes: 45400,
    comments: 1482,
    shares: 2870,
    products: [],
    soundtrack: "son original — yanis.streetnotes",
    badge: "COLLAB",
    brandTags: ["Supreme", "Martine Rose"],
    gallery: posts("supreme-martine-rose", 2),
  },
  {
    id: "post-margiela-future",
    creator: karim,
    title: "Future",
    caption:
      "La Margiela Future, d'où elle vient vraiment. Je vous raconte en 30 secondes les sneakers qui l'ont inspirée, et pourquoi elle revient partout cette année. Vous l'avez en blanc ou en noir ?",
    location: "Paris 13e",
    tags: ["#maisonmargiela", "#future", "#sneakers", "#histoire"],
    seed: "margiela-future",
    likes: 201,
    comments: 22,
    shares: 14,
    products: [],
    soundtrack: "son original — karim.kicks",
    brandTags: ["Maison Margiela"],
  },
  {
    id: "post-gucci-ss27-details",
    creator: lea,
    title: "Détails",
    caption:
      "Les détails du défilé Gucci SS27 que vous n'avez pas pu voir. Les mors dorés jusque sur le col du polo, les rayures web, le blason brodé, le mors en épaulette sur le caban. Le Horsebit est partout et c'est très réussi.",
    location: "Milan",
    tags: ["#gucci", "#ss27", "#horsebit", "#details"],
    seed: "gucci-ss27-details",
    likes: 16300,
    comments: 212,
    shares: 672,
    products: [],
    soundtrack: "son original — lea.details",
    badge: "SS27",
    brandTags: ["Gucci"],
  },
];
