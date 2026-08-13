/* ============================================================
   SOLANGE — mock dataset
   Fake-but-plausible French resale fashion feed. No backend.
   Every "look" is a video-style clip with shoppable products.
   ============================================================ */

/** Shared base for every sellable piece (feed product or catalog tile). */
export type Item = {
  id: string;
  name: string;
  brand: string;
  priceEUR: number;
  originalEUR?: number;
  size: string;
  condition: string;
};

export type Product = Item & {
  hotspot: { x: number; y: number }; // % position over the media
};

export type Creator = {
  id: string;
  handle: string;
  name: string;
  seed: string;
  followers: number;
  verified?: boolean;
  live?: boolean;
};

export type Look = {
  id: string;
  creator: Creator;
  title: string; // big editorial display word
  caption: string;
  location: string;
  tags: string[];
  seed: string;
  likes: number;
  comments: number;
  shares: number;
  products: Product[];
  soundtrack: string;
  badge?: string; // e.g. "DROP", "ARCHIVE"
  /** Post nature: look (default), edito framing, actu (news), achats (haul). */
  kind?: "look" | "edito" | "actu" | "achats";
  /** Brands discussed in the post (actu / achats), for chips & search. */
  brandTags?: string[];
  /** Catalog ids referenced by the post without on-media hotspots. */
  linkedProductIds?: string[];
  /** Instagram-style image carousel — shown (swipeable) in place of the single
   *  hero when it holds more than one image. Paths under /public. */
  gallery?: string[];
};

const creators: Record<string, Creator> = {
  lou: {
    id: "c1",
    handle: "lou.archive",
    name: "Lou Mercier",
    seed: "lou-mercier-21",
    followers: 24300,
    verified: true,
    live: true,
  },
  samir: {
    id: "c2",
    handle: "samir.fits",
    name: "Samir Benali",
    seed: "samir-b-09",
    followers: 88200,
    verified: true,
  },
  neige: {
    id: "c3",
    handle: "neige.vintage",
    name: "Neige",
    seed: "neige-77",
    followers: 12800,
  },
  theo: {
    id: "c4",
    handle: "theo.grail",
    name: "Théo Laurent",
    seed: "theo-grail-3",
    followers: 41100,
    verified: true,
  },
  maya: {
    id: "c5",
    handle: "maya.curates",
    name: "Maya Diallo",
    seed: "maya-d-55",
    followers: 156000,
    verified: true,
  },
  yuki: {
    id: "c6",
    handle: "yuki.paris",
    name: "Yuki Tanaka",
    seed: "yuki-p-12",
    followers: 33400,
  },
};

export const looks: Look[] = [
  {
    id: "l1",
    creator: creators.lou,
    title: "Archive",
    caption:
      "Total look archive 90s. La veste en cuir je l'ai chinée aux Puces de Saint-Ouen, jamais portée depuis.",
    location: "Paris 18e · Les Puces",
    tags: ["#archive", "#vintage", "#leather", "#ootd"],
    seed: "solange-look-leather-01",
    likes: 18420,
    comments: 642,
    shares: 311,
    soundtrack: "Crystal Castles — Not In Love",
    badge: "ARCHIVE",
    products: [
      {
        id: "k1",
        name: "Veste motard cuir vieilli",
        brand: "Acne Studios",
        priceEUR: 245,
        originalEUR: 890,
        size: "M",
        condition: "Très bon état",
        hotspot: { x: 35, y: 23 },
      },
      {
        id: "k8",
        name: "501 droit délavé",
        brand: "Levi's",
        priceEUR: 49,
        originalEUR: 120,
        size: "W30",
        condition: "Bon état",
        hotspot: { x: 64, y: 27 },
      },
    ],
  },
  {
    id: "l2",
    creator: creators.samir,
    title: "Workwear",
    caption:
      "Drop streetwear de la semaine. Le gilet Carhartt est un must, je le porte depuis 2 ans, il vieillit trop bien.",
    location: "Lyon · Croix-Rousse",
    tags: ["#streetwear", "#carhartt", "#workwear"],
    seed: "solange-look-street-02",
    likes: 9650,
    comments: 288,
    shares: 142,
    soundtrack: "Frank Ocean — Pink + White",
    badge: "DROP",
    gallery: [
      "/img/carousel/prada1.jpg",
      "/img/carousel/prada2.jpg",
      "/img/carousel/prada3.jpg",
      "/img/carousel/prada4.jpg",
      "/img/carousel/prada5.jpg",
      "/img/carousel/prada6.jpg",
    ],
    products: [
      {
        id: "k3",
        name: "Gilet Detroit doublé sherpa",
        brand: "Carhartt WIP",
        priceEUR: 95,
        originalEUR: 189,
        size: "L",
        condition: "Très bon état",
        hotspot: { x: 28, y: 24 },
      },
      {
        id: "k7",
        name: "XT-6 suède gris",
        brand: "Salomon",
        priceEUR: 110,
        size: "42",
        condition: "Neuf avec étiquette",
        hotspot: { x: 70, y: 26 },
      },
      {
        id: "k14",
        name: "Bonnet côtelé laine",
        brand: "Stüssy",
        priceEUR: 28,
        size: "TU",
        condition: "Bon état",
        hotspot: { x: 50, y: 20 },
      },
    ],
  },
  {
    id: "l3",
    creator: creators.maya,
    title: "Minimal",
    caption:
      "Pièce signature de ma garde-robe : un Margiela trouvé en dépôt-vente à Marais. La coupe est intemporelle.",
    location: "Paris 4e · Le Marais",
    tags: ["#margiela", "#minimal", "#editorial"],
    seed: "solange-look-margiela-03",
    likes: 42100,
    comments: 1203,
    shares: 980,
    soundtrack: "Sade — Cherish The Day",
    products: [
      {
        id: "k2",
        name: "Manteau laine épaules structurées",
        brand: "Maison Margiela",
        priceEUR: 420,
        originalEUR: 1450,
        size: "38",
        condition: "Excellent état",
        hotspot: { x: 52, y: 23 },
      },
    ],
  },
  {
    id: "l4",
    creator: creators.theo,
    title: "Cyber",
    caption:
      "Grail unlocked. J'ai mis 8 mois à trouver ce Gaultier en taille. Patience récompensée chez mes revendeurs préférés.",
    location: "Bordeaux",
    tags: ["#grail", "#gaultier", "#archivefashion"],
    seed: "solange-look-gaultier-04",
    likes: 27800,
    comments: 854,
    shares: 612,
    soundtrack: "Aphex Twin — Avril 14th",
    badge: "GRAIL",
    products: [
      {
        id: "k4",
        name: "Chemise mesh imprimé cyber",
        brand: "Jean Paul Gaultier",
        priceEUR: 340,
        originalEUR: 620,
        size: "48",
        condition: "Très bon état",
        hotspot: { x: 34, y: 22 },
      },
      {
        id: "k17",
        name: "Lunettes ovales métal",
        brand: "Oakley Vintage",
        priceEUR: 65,
        size: "TU",
        condition: "Bon état",
        hotspot: { x: 66, y: 26 },
      },
    ],
  },
  {
    id: "l5",
    creator: creators.neige,
    title: "Plissé",
    caption:
      "Mon dressing d'hiver en seconde main. Le plissé Issey c'est ma plus belle trouvaille de l'année.",
    location: "Lille",
    tags: ["#isseymiyake", "#pleats", "#slowfashion"],
    seed: "solange-look-issey-05",
    likes: 6140,
    comments: 197,
    shares: 88,
    soundtrack: "Beach House — Space Song",
    products: [
      {
        id: "k5",
        name: "Pantalon plissé technique",
        brand: "Pleats Please Issey Miyake",
        priceEUR: 180,
        originalEUR: 390,
        size: "2",
        condition: "Très bon état",
        hotspot: { x: 35, y: 24 },
      },
      {
        id: "k13",
        name: "Mary Janes cuir verni",
        brand: "Dr. Martens",
        priceEUR: 70,
        size: "39",
        condition: "Bon état",
        hotspot: { x: 65, y: 22 },
      },
    ],
  },
  {
    id: "l6",
    creator: creators.yuki,
    title: "Gorpcore",
    caption:
      "Layering technique pour les jours gris. Tout est dispo, j'expédie depuis Paris en 24h.",
    location: "Paris 11e",
    tags: ["#gorpcore", "#arcteryx", "#layering"],
    seed: "solange-look-gorp-06",
    likes: 15300,
    comments: 421,
    shares: 274,
    soundtrack: "Bonobo — Kerala",
    badge: "DROP",
    products: [
      {
        id: "k6",
        name: "Veste shell Gore-Tex Beta",
        brand: "Arc'teryx",
        priceEUR: 290,
        originalEUR: 550,
        size: "M",
        condition: "Excellent état",
        hotspot: { x: 34, y: 23 },
      },
      {
        id: "k16",
        name: "Banane ripstop noire",
        brand: "Patagonia",
        priceEUR: 35,
        size: "TU",
        condition: "Bon état",
        hotspot: { x: 66, y: 26 },
      },
    ],
  },
  {
    id: "l7",
    kind: "actu",
    creator: creators.maya,
    title: "Actu",
    caption:
      "Nouvelle collection Lemaire, on en parle. Des volumes amples, zéro logo, et le Croissant bag qui reste la pièce la plus recherchée de la maison en seconde main.",
    location: "Paris 3e · Haut-Marais",
    tags: ["#lemaire", "#actu", "#quietluxury"],
    brandTags: ["Lemaire"],
    linkedProductIds: ["k12"],
    seed: "solange-post-actu-lemaire-07",
    likes: 21400,
    comments: 733,
    shares: 502,
    soundtrack: "Arthur Russell — A Little Lost",
    badge: "ACTU",
    products: [],
  },
  {
    id: "l8",
    kind: "achats",
    creator: creators.samir,
    title: "Achats",
    caption:
      "Mes derniers achats chez Carhartt & Salomon. Le gilet Detroit et les XT-6, les deux chinés sur SOLANGE en moins d'une semaine. Zéro regret.",
    location: "Lyon · Croix-Rousse",
    tags: ["#haul", "#carhartt", "#salomon", "#secondemain"],
    brandTags: ["Carhartt WIP", "Salomon"],
    linkedProductIds: ["k3", "k7"],
    seed: "solange-post-achats-samir-08",
    likes: 11250,
    comments: 316,
    shares: 189,
    soundtrack: "Little Simz — Selhurst",
    products: [],
  },
];

export const feedTabs = ["Pour vous", "Abonnements"] as const;

export const trendingTags = [
  "#archive",
  "#y2k",
  "#gorpcore",
  "#margiela",
  "#vintagedenim",
  "#streetwear",
  "#quietluxury",
  "#90s",
];

/* ---------- Marketplace catalog (Découvrir) ---------- */

export const categories = [
  "Tout",
  "Femme",
  "Homme",
  "Archive",
  "Streetwear",
  "Luxe",
  "Sneakers",
  "Accessoires",
] as const;

export type CatalogItem = Item & {
  seed: string;
  category: (typeof categories)[number];
  seller: string;
  likes: number;
  span?: boolean; // tall tile in the masonry
};

export const catalog: CatalogItem[] = [
  { id: "k1", brand: "Acne Studios", name: "Veste motard cuir vieilli", priceEUR: 245, originalEUR: 890, size: "M", condition: "Très bon état", seed: "cat-acne-leather", category: "Archive", seller: "lou.archive", likes: 312, span: true },
  { id: "k2", brand: "Maison Margiela", name: "Manteau laine épaules structurées", priceEUR: 420, originalEUR: 1450, size: "38", condition: "Excellent état", seed: "cat-margiela-coat", category: "Luxe", seller: "maya.curates", likes: 980 },
  { id: "k3", brand: "Carhartt WIP", name: "Gilet Detroit doublé sherpa", priceEUR: 95, originalEUR: 189, size: "L", condition: "Très bon état", seed: "cat-carhartt-vest", category: "Streetwear", seller: "samir.fits", likes: 142 },
  { id: "k4", brand: "Jean Paul Gaultier", name: "Chemise mesh imprimé cyber", priceEUR: 340, originalEUR: 620, size: "48", condition: "Très bon état", seed: "cat-jpg-mesh", category: "Archive", seller: "theo.grail", likes: 410, span: true },
  { id: "k5", brand: "Pleats Please Issey Miyake", name: "Pantalon plissé technique", priceEUR: 180, originalEUR: 390, size: "2", condition: "Très bon état", seed: "cat-issey-pleats", category: "Femme", seller: "neige.vintage", likes: 88 },
  { id: "k6", brand: "Arc'teryx", name: "Veste shell Gore-Tex Beta", priceEUR: 290, originalEUR: 550, size: "M", condition: "Excellent état", seed: "cat-arcteryx-beta", category: "Homme", seller: "yuki.paris", likes: 274 },
  { id: "k7", brand: "Salomon", name: "XT-6 suède gris", priceEUR: 110, size: "42", condition: "Neuf avec étiquette", seed: "cat-salomon-xt6", category: "Sneakers", seller: "samir.fits", likes: 156 },
  { id: "k8", brand: "Levi's", name: "501 droit délavé", priceEUR: 49, originalEUR: 120, size: "W30", condition: "Bon état", seed: "cat-levis-501", category: "Homme", seller: "lou.archive", likes: 64 },
  { id: "k9", brand: "Prada", name: "Sac nylon Re-Edition 2000", priceEUR: 680, originalEUR: 1100, size: "TU", condition: "Très bon état", seed: "cat-prada-nylon", category: "Luxe", seller: "maya.curates", likes: 1240, span: true },
  { id: "k10", brand: "Comme des Garçons", name: "Cardigan zip laine", priceEUR: 210, originalEUR: 480, size: "M", condition: "Excellent état", seed: "cat-cdg-cardigan", category: "Archive", seller: "theo.grail", likes: 198 },
  { id: "k11", brand: "Nike", name: "Air Max 90 vintage", priceEUR: 95, size: "41", condition: "Bon état", seed: "cat-nike-am90", category: "Sneakers", seller: "nouh.archive", likes: 142 },
  { id: "k12", brand: "Lemaire", name: "Croissant bag cuir", priceEUR: 390, originalEUR: 590, size: "TU", condition: "Très bon état", seed: "cat-lemaire-croissant", category: "Accessoires", seller: "maya.curates", likes: 540 },
  { id: "k13", brand: "Dr. Martens", name: "Mary Janes cuir verni", priceEUR: 70, size: "39", condition: "Bon état", seed: "cat-drmartens-mj", category: "Femme", seller: "nouh.archive", likes: 51 },
  { id: "k14", brand: "Stüssy", name: "Bonnet côtelé laine", priceEUR: 28, size: "TU", condition: "Bon état", seed: "cat-stussy-beanie", category: "Accessoires", seller: "samir.fits", likes: 33 },
  { id: "k15", brand: "Helmut Lang", name: "Veste tailleur archive 99", priceEUR: 260, originalEUR: 700, size: "40", condition: "Très bon état", seed: "cat-helmut-blazer", category: "Femme", seller: "lou.archive", likes: 220, span: true },
  { id: "k16", brand: "Patagonia", name: "Banane ripstop noire", priceEUR: 35, size: "TU", condition: "Bon état", seed: "cat-patagonia-bag", category: "Accessoires", seller: "nouh.archive", likes: 77 },
  { id: "k17", brand: "Oakley Vintage", name: "Lunettes ovales métal", priceEUR: 65, size: "TU", condition: "Bon état", seed: "cat-oakley-oval", category: "Accessoires", seller: "nouh.archive", likes: 96 },
];

export const conditions = [
  "Neuf avec étiquette",
  "Excellent état",
  "Très bon état",
  "Bon état",
] as const;

/** Lookup a single catalog tile by id. */
export function catalogItem(id: string): CatalogItem | undefined {
  return catalog.find((it) => it.id === id);
}

/** Pieces the current user has saved (favoris). */
export const savedIds: string[] = ["k1", "k2", "k4", "k9", "k12", "k15"];

export const savedItems: CatalogItem[] = savedIds
  .map((id) => catalogItem(id))
  .filter((it): it is CatalogItem => it !== undefined);

/** Handles the current user follows (drives the "Suivis" feed tab). */
export const followedHandles: string[] = [
  "maya.curates",
  "samir.fits",
  "lou.archive",
];

/* ---------- Drops ---------- */

export type Drop = {
  id: string;
  title: string;
  creator: Creator;
  collab?: string;
  startsIn: string;
  /** Seconds until the drop opens; ticked down live by the UI. 0 = en direct. */
  secondsToStart: number;
  seed: string;
  badge: "DROP" | "LIVE" | "ARCHIVE";
  productIds: string[];
};

export const drops: Drop[] = [
  {
    id: "d1",
    title: "Cuir & Archive",
    creator: creators.lou,
    collab: "Les Puces de Saint-Ouen",
    startsIn: "En direct",
    secondsToStart: 0,
    seed: "solange-drop-leather",
    badge: "LIVE",
    productIds: ["k1", "k8", "k15"],
  },
  {
    id: "d2",
    title: "Workwear Lyonnais",
    creator: creators.samir,
    startsIn: "Dans 2 h",
    secondsToStart: 8070, // ~02:14:30
    seed: "solange-drop-workwear",
    badge: "DROP",
    productIds: ["k3", "k7", "k14"],
  },
  {
    id: "d3",
    title: "Maison Margiela — Pièces rares",
    creator: creators.maya,
    collab: "Dépôt-vente Le Marais",
    startsIn: "Demain · 19 h",
    secondsToStart: 100800, // ~28 h
    seed: "solange-drop-margiela",
    badge: "DROP",
    productIds: ["k2", "k9", "k12"],
  },
  {
    id: "d4",
    title: "Grails Gaultier",
    creator: creators.theo,
    startsIn: "Archive",
    secondsToStart: 0,
    seed: "solange-drop-gaultier",
    badge: "ARCHIVE",
    productIds: ["k4", "k10"],
  },
];

/* ---------- Notifications ---------- */

export type Notif = {
  id: string;
  kind: "like" | "follow" | "sale" | "offer" | "drop";
  actorName: string;
  actorSeed: string;
  actorHandle: string;
  text: string;
  time: string;
  unread?: boolean;
};

export const notifications: Notif[] = [
  {
    id: "n1",
    kind: "offer",
    actorName: "Théo Laurent",
    actorSeed: "theo-grail-3",
    actorHandle: "theo.grail",
    text: "propose 320 € pour ta Chemise mesh Gaultier.",
    time: "Il y a 12 min",
    unread: true,
  },
  {
    id: "n2",
    kind: "sale",
    actorName: "Maya Diallo",
    actorSeed: "maya-d-55",
    actorHandle: "maya.curates",
    text: "a acheté ton Manteau laine Margiela. À expédier sous 48 h.",
    time: "Il y a 1 h",
    unread: true,
  },
  {
    id: "n3",
    kind: "follow",
    actorName: "Samir Benali",
    actorSeed: "samir-b-09",
    actorHandle: "samir.fits",
    text: "a commencé à te suivre.",
    time: "Il y a 3 h",
  },
  {
    id: "n4",
    kind: "like",
    actorName: "Neige",
    actorSeed: "neige-77",
    actorHandle: "neige.vintage",
    text: "a aimé ton look Plissé Issey Miyake.",
    time: "Hier",
  },
  {
    id: "n5",
    kind: "drop",
    actorName: "Lou Mercier",
    actorSeed: "lou-mercier-21",
    actorHandle: "lou.archive",
    text: "lance le drop Cuir & Archive en direct maintenant.",
    time: "Hier",
  },
  {
    id: "n6",
    kind: "like",
    actorName: "Yuki Tanaka",
    actorSeed: "yuki-p-12",
    actorHandle: "yuki.paris",
    text: "a aimé ta Veste shell Arc'teryx.",
    time: "Lun",
  },
];

/* ---------- Current user (vitrine) ---------- */

export const me = {
  name: "Nouh Benzidane",
  handle: "nouh.archive",
  seed: "solange-me-01",
  bio: "Curateur seconde main · Paris. Je chine, je documente, je revends. Archive & pièces rares.",
  location: "Paris, FR",
  followers: 8420,
  following: 312,
  sales: 147,
  rating: 4.9,
  verified: true,
};

/* ---------- Messagerie ---------- */

export type Message = { from: "me" | "them"; text: string };
export type Conversation = {
  id: string;
  name: string;
  handle: string;
  seed: string;
  verified?: boolean;
  itemBrand: string;
  itemName: string;
  itemSeed: string;
  itemPriceEUR: number;
  time: string;
  unread: number;
  messages: Message[];
};

export const conversations: Conversation[] = [
  {
    id: "m1",
    name: "Maya Diallo",
    handle: "maya.curates",
    seed: "maya-d-55",
    verified: true,
    itemBrand: "Maison Margiela",
    itemName: "Manteau laine",
    itemSeed: "cat-margiela-coat",
    itemPriceEUR: 420,
    time: "14:02",
    unread: 0,
    messages: [
      { from: "me", text: "Bonjour ! Le manteau est toujours dispo en 38 ?" },
      { from: "them", text: "Oui, en parfait état. Je peux t'envoyer des photos détail." },
      { from: "me", text: "Avec plaisir. Tu acceptes 400 ?" },
      { from: "them", text: "On dit 410 et je t'offre la livraison 🤍" },
      { from: "me", text: "Parfait, je commande." },
      { from: "them", text: "Top, je l'envoie demain en suivi !" },
    ],
  },
  {
    id: "m2",
    name: "Samir Benali",
    handle: "samir.fits",
    seed: "samir-b-09",
    verified: true,
    itemBrand: "Carhartt WIP",
    itemName: "Gilet Detroit",
    itemSeed: "cat-carhartt-vest",
    itemPriceEUR: 95,
    time: "11:30",
    unread: 2,
    messages: [
      { from: "them", text: "Hello ! Le gilet est dispo en L ?" },
      { from: "them", text: "Je suis très intéressé 🙏" },
    ],
  },
  {
    id: "m3",
    name: "Théo Laurent",
    handle: "theo.grail",
    seed: "theo-grail-3",
    verified: true,
    itemBrand: "Jean Paul Gaultier",
    itemName: "Chemise mesh",
    itemSeed: "cat-jpg-mesh",
    itemPriceEUR: 340,
    time: "Hier",
    unread: 0,
    messages: [
      { from: "them", text: "Pièce incroyable. Tu ferais un petit geste sur le prix ?" },
      { from: "me", text: "Je peux faire 320, c'est une vraie archive." },
    ],
  },
  {
    id: "m4",
    name: "Neige",
    handle: "neige.vintage",
    seed: "neige-77",
    itemBrand: "Issey Miyake",
    itemName: "Plissé technique",
    itemSeed: "cat-issey-pleats",
    itemPriceEUR: 180,
    time: "Lun",
    unread: 0,
    messages: [
      { from: "them", text: "Merci beaucoup pour la commande 🤍" },
      { from: "me", text: "Avec plaisir, hâte de le porter !" },
    ],
  },
  {
    id: "m5",
    name: "Yuki Tanaka",
    handle: "yuki.paris",
    seed: "yuki-p-12",
    itemBrand: "Arc'teryx",
    itemName: "Veste Beta",
    itemSeed: "cat-arcteryx-beta",
    itemPriceEUR: 290,
    time: "Dim",
    unread: 0,
    messages: [
      { from: "them", text: "La fermeture principale est nickel ?" },
      { from: "me", text: "Oui, tout fonctionne parfaitement. Zéro défaut." },
    ],
  },
];

/* ---------- Premium ---------- */

export type Plan = {
  id: string;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    price: "0 €",
    tagline: "Pour commencer à chiner et vendre.",
    features: [
      "Commission dégressive 2 à 4 %",
      "Mises en avant à la carte (2 € / 72 h)",
      "Messagerie acheteurs / vendeurs",
      "Favoris & suivi de vendeurs",
    ],
    cta: "Plan actuel",
  },
  {
    id: "premium",
    name: "Premium",
    price: "4,99 €",
    tagline: "Pour les vendeurs réguliers.",
    features: [
      "0 % de commission sur tes ventes",
      "2 mises en avant offertes / mois",
      "Badge Premium sur ton profil",
      "Statistiques de ventes",
    ],
    cta: "Passer Premium",
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "9,99 €",
    tagline: "Pour les pros & friperies.",
    features: [
      "0 % de commission",
      "5 mises en avant / mois",
      "Accès prioritaire aux drops",
      "Statistiques avancées",
      "Ventes aux enchères",
    ],
    cta: "Passer Pro",
  },
];

/* ---------- Commentaires (par look) ---------- */

export type Comment = {
  seed: string; // avatar seed (Photo component)
  handle: string;
  name: string;
  text: string;
  time: string;
};

/** Mock comment threads keyed by look id. Drives the feed comment sheet. */
export const commentsByLook: Record<string, Comment[]> = {
  l1: [
    {
      seed: "maya-d-55",
      handle: "maya.curates",
      name: "Maya Diallo",
      text: "La patine du cuir est parfaite, j'adore 🤍",
      time: "Il y a 2 h",
    },
    {
      seed: "theo-grail-3",
      handle: "theo.grail",
      name: "Théo Laurent",
      text: "Le 501 délavé avec, combo intemporel.",
      time: "Il y a 1 h",
    },
    {
      seed: "neige-77",
      handle: "neige.vintage",
      name: "Neige",
      text: "Les Puces c'est la mine d'or, validé.",
      time: "Il y a 47 min",
    },
    {
      seed: "yuki-p-12",
      handle: "yuki.paris",
      name: "Yuki Tanaka",
      text: "Tu shippes en province ?",
      time: "Il y a 31 min",
    },
    {
      seed: "samir-b-09",
      handle: "samir.fits",
      name: "Samir Benali",
      text: "Taille M ça part vite, fonce 🔥",
      time: "Il y a 12 min",
    },
  ],
  l2: [
    {
      seed: "lou-mercier-21",
      handle: "lou.archive",
      name: "Lou Mercier",
      text: "Le Carhartt vieillit tellement bien, vrai.",
      time: "Il y a 3 h",
    },
    {
      seed: "yuki-p-12",
      handle: "yuki.paris",
      name: "Yuki Tanaka",
      text: "Les XT-6 en 42 encore dispo ?",
      time: "Il y a 2 h",
    },
    {
      seed: "neige-77",
      handle: "neige.vintage",
      name: "Neige",
      text: "Layering propre, ça respire la Croix-Rousse.",
      time: "Il y a 1 h",
    },
    {
      seed: "maya-d-55",
      handle: "maya.curates",
      name: "Maya Diallo",
      text: "Le bonnet Stüssy complète nickel 🧶",
      time: "Il y a 38 min",
    },
  ],
  l3: [
    {
      seed: "lou-mercier-21",
      handle: "lou.archive",
      name: "Lou Mercier",
      text: "La coupe Margiela, intemporelle. Sublime trouvaille.",
      time: "Il y a 5 h",
    },
    {
      seed: "theo-grail-3",
      handle: "theo.grail",
      name: "Théo Laurent",
      text: "Dépôt-vente du Marais, les vraies pépites.",
      time: "Il y a 4 h",
    },
    {
      seed: "samir-b-09",
      handle: "samir.fits",
      name: "Samir Benali",
      text: "Épaules structurées = pièce signature, d'accord.",
      time: "Il y a 2 h",
    },
    {
      seed: "neige-77",
      handle: "neige.vintage",
      name: "Neige",
      text: "Le minimalisme noir & blanc te va trop bien 🤍",
      time: "Il y a 1 h",
    },
    {
      seed: "yuki-p-12",
      handle: "yuki.paris",
      name: "Yuki Tanaka",
      text: "Investissement justifié, ça se garde à vie.",
      time: "Il y a 22 min",
    },
  ],
  l4: [
    {
      seed: "samir-b-09",
      handle: "samir.fits",
      name: "Samir Benali",
      text: "8 mois de chasse, le grail mérité 🙏",
      time: "Il y a 6 h",
    },
    {
      seed: "maya-d-55",
      handle: "maya.curates",
      name: "Maya Diallo",
      text: "Le mesh Gaultier archive, pièce de musée.",
      time: "Il y a 3 h",
    },
    {
      seed: "lou-mercier-21",
      handle: "lou.archive",
      name: "Lou Mercier",
      text: "Les lunettes ovales finissent le total look.",
      time: "Il y a 2 h",
    },
    {
      seed: "neige-77",
      handle: "neige.vintage",
      name: "Neige",
      text: "Patience récompensée, respect.",
      time: "Il y a 54 min",
    },
  ],
  l5: [
    {
      seed: "maya-d-55",
      handle: "maya.curates",
      name: "Maya Diallo",
      text: "Le plissé Issey, ma pièce d'hiver préférée aussi 🤍",
      time: "Il y a 4 h",
    },
    {
      seed: "lou-mercier-21",
      handle: "lou.archive",
      name: "Lou Mercier",
      text: "Trouvaille de l'année validée, sans hésiter.",
      time: "Il y a 2 h",
    },
    {
      seed: "theo-grail-3",
      handle: "theo.grail",
      name: "Théo Laurent",
      text: "Les Mary Janes Dr. Martens, choix audacieux.",
      time: "Il y a 1 h",
    },
    {
      seed: "samir-b-09",
      handle: "samir.fits",
      name: "Samir Benali",
      text: "Slow fashion bien pensée, ça change.",
      time: "Il y a 28 min",
    },
  ],
  l6: [
    {
      seed: "theo-grail-3",
      handle: "theo.grail",
      name: "Théo Laurent",
      text: "Le shell Arc'teryx Beta, indémodable.",
      time: "Il y a 3 h",
    },
    {
      seed: "lou-mercier-21",
      handle: "lou.archive",
      name: "Lou Mercier",
      text: "Gorpcore propre pour les jours gris ☁️",
      time: "Il y a 2 h",
    },
    {
      seed: "maya-d-55",
      handle: "maya.curates",
      name: "Maya Diallo",
      text: "Expédition 24h depuis Paris, parfait.",
      time: "Il y a 1 h",
    },
    {
      seed: "neige-77",
      handle: "neige.vintage",
      name: "Neige",
      text: "La banane Patagonia complète le layering 🎒",
      time: "Il y a 41 min",
    },
  ],
};

/* ---------- Parrainage (referral) ---------- */

export type InviteStep = { label: string; detail: string };

export const invite: {
  code: string;
  invited: number;
  reward: string;
  steps: InviteStep[];
} = {
  code: "SOLANGE-NOUH",
  invited: 12,
  reward: "5 € par ami qui vend sa 1re pièce",
  steps: [
    {
      label: "Partage ton code",
      detail: "Envoie SOLANGE-NOUH à un ami qui chine ou qui revend.",
    },
    {
      label: "Il rejoint SOLANGE",
      detail: "Ton ami crée son compte avec ton code de parrainage.",
    },
    {
      label: "Il vend sa 1re pièce",
      detail: "Dès sa première vente validée, vous gagnez chacun 5 €.",
    },
  ],
};

/* ---------- Live shopping (streaming) ---------- */

export type ChatLine = { handle: string; seed: string; text: string };
export type Stream = {
  id: string;
  creator: Creator;
  title: string;
  viewers: number;
  live: boolean;
  startsIn?: string;
  seed: string;
  video: string; // preview clip path
  poster: string;
  productIds: string[]; // shoppable during the live
  chat: ChatLine[];
};

export const streams: Stream[] = [
  {
    id: "s1",
    creator: creators.lou,
    title: "Vente live · Archive cuir 90s",
    viewers: 1240,
    live: true,
    seed: "solange-look-leather-01",
    video: "/video/l1.mp4",
    poster: "/video/l1.jpg",
    productIds: ["k1", "k8", "k15"],
    chat: [
      { handle: "maya.curates", seed: "maya-d-55", text: "La veste est incroyable 🖤" },
      { handle: "theo.grail", seed: "theo-grail-3", text: "Elle taille comment ?" },
      { handle: "neige.vintage", seed: "neige-77", text: "Je prends le 501 !" },
      { handle: "yuki.paris", seed: "yuki-p-12", text: "Drop de folie" },
    ],
  },
  {
    id: "s2",
    creator: creators.maya,
    title: "Margiela & pièces couture en direct",
    viewers: 3420,
    live: true,
    seed: "solange-look-margiela-03",
    video: "/video/l3.mp4",
    poster: "/video/l3.jpg",
    productIds: ["k2", "k12", "k9"],
    chat: [
      { handle: "lou.archive", seed: "lou-mercier-21", text: "Le manteau 😍" },
      { handle: "samir.fits", seed: "samir-b-09", text: "Combien le sac Prada ?" },
      { handle: "theo.grail", seed: "theo-grail-3", text: "Première 🙌" },
    ],
  },
  {
    id: "s3",
    creator: creators.theo,
    title: "Grails & archives rares",
    viewers: 890,
    live: true,
    seed: "solange-look-gaultier-04",
    video: "/video/l4.mp4",
    poster: "/video/l4.jpg",
    productIds: ["k4", "k10"],
    chat: [
      { handle: "yuki.paris", seed: "yuki-p-12", text: "Le Gaultier est dispo ?" },
      { handle: "maya.curates", seed: "maya-d-55", text: "Patrimoine 🔥" },
    ],
  },
  {
    id: "s4",
    creator: creators.samir,
    title: "Sélection streetwear · drop du soir",
    viewers: 0,
    live: false,
    startsIn: "Dans 32 min",
    seed: "solange-look-street-02",
    video: "/video/l2.mp4",
    poster: "/video/l2.jpg",
    productIds: ["k3", "k7", "k14"],
    chat: [],
  },
  {
    id: "s5",
    creator: creators.yuki,
    title: "Gorpcore & technique",
    viewers: 0,
    live: false,
    startsIn: "Ce soir · 20h00",
    seed: "solange-look-gorp-06",
    video: "/video/l6.mp4",
    poster: "/video/l6.jpg",
    productIds: ["k6", "k16"],
    chat: [],
  },
];

/* ---------- Communautés (cercles créateurs) ---------- */

export type CommunityThread = {
  author: string;
  handle: string;
  seed: string;
  title: string;
  excerpt: string;
  replies: number;
  time: string;
};

export type Community = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  host: Creator;
  members: number;
  posts: number;
  online: number;
  topics: string[];
  seed: string;
  /** Avatars de membres mis en avant (aperçu de la pile). */
  memberSeeds: string[];
  threads: CommunityThread[];
};

export const communities: Community[] = [
  {
    id: "cm1",
    name: "Rap & Mode",
    tagline: "L'impact des rappeurs sur le vestiaire.",
    about:
      "Du bling des 2000s au quiet luxury de la nouvelle scène : on décortique comment le rap dicte les tendances, des grails portés en clip aux collabs qui font flamber la cote en seconde main.",
    host: creators.samir,
    members: 18400,
    posts: 1240,
    online: 312,
    topics: ["#rap", "#grails", "#collabs", "#culture"],
    seed: "solange-cm-rap-mode",
    memberSeeds: ["samir-b-09", "theo-grail-3", "maya-d-55", "yuki-p-12", "lou-mercier-21"],
    threads: [
      {
        author: "Samir Benali",
        handle: "samir.fits",
        seed: "samir-b-09",
        title: "Pourquoi le Carhartt est redevenu un symbole rap",
        excerpt:
          "Entre Detroit et la drill parisienne, le workwear a changé de sens. On en parle avant le prochain drop.",
        replies: 84,
        time: "Il y a 2 h",
      },
      {
        author: "Théo Laurent",
        handle: "theo.grail",
        seed: "theo-grail-3",
        title: "Les grails Gaultier vus dans les clips 90s",
        excerpt:
          "La chemise mesh cyber, c'est direct sorti d'un clip. Fil de repérage des pièces d'archive portées à l'écran.",
        replies: 51,
        time: "Hier",
      },
    ],
  },
  {
    id: "cm2",
    name: "Archives & Culture",
    tagline: "Les pièces qui racontent une époque.",
    about:
      "Un cercle pour les chineur·euses d'archive : Margiela déconstruit, Helmut Lang 99, Issey plissé. On documente la provenance, on partage les trouvailles, on transmet.",
    host: creators.maya,
    members: 9800,
    posts: 870,
    online: 143,
    topics: ["#archive", "#margiela", "#provenance", "#slowfashion"],
    seed: "solange-cm-archive-culture",
    memberSeeds: ["maya-d-55", "lou-mercier-21", "neige-77", "theo-grail-3"],
    threads: [
      {
        author: "Maya Diallo",
        handle: "maya.curates",
        seed: "maya-d-55",
        title: "Reconnaître un vrai Margiela d'archive",
        excerpt:
          "Étiquette blanche cousue aux 4 coins, numéros entourés : le guide anti-contrefaçon de la communauté.",
        replies: 132,
        time: "Il y a 5 h",
      },
      {
        author: "Neige",
        handle: "neige.vintage",
        seed: "neige-77",
        title: "Issey Miyake : entretenir le plissé technique",
        excerpt:
          "Comment laver, plier et transmettre une pièce Pleats Please sans jamais l'abîmer.",
        replies: 47,
        time: "Lun",
      },
    ],
  },
  {
    id: "cm3",
    name: "Streetwear & Origines",
    tagline: "De la contre-culture au podium.",
    about:
      "Skate, gorpcore, workwear, sneakers : on remonte le fil des sous-cultures et de leurs codes. Débats, drops et sélections partagées chaque semaine.",
    host: creators.yuki,
    members: 24100,
    posts: 2010,
    online: 508,
    topics: ["#streetwear", "#gorpcore", "#sneakers", "#skate"],
    seed: "solange-cm-street-origines",
    memberSeeds: ["yuki-p-12", "samir-b-09", "lou-mercier-21", "maya-d-55", "neige-77"],
    threads: [
      {
        author: "Yuki Tanaka",
        handle: "yuki.paris",
        seed: "yuki-p-12",
        title: "Gorpcore : effet de mode ou vestiaire durable ?",
        excerpt:
          "La Beta Arc'teryx traverse les saisons. On débat de la technique comme investissement seconde main.",
        replies: 76,
        time: "Il y a 3 h",
      },
      {
        author: "Lou Mercier",
        handle: "lou.archive",
        seed: "lou-mercier-21",
        title: "Les Puces, meilleure école du style ?",
        excerpt:
          "Retour sur dix ans de chine aux allées Vernaison. Vos meilleures trouvailles à moins de 20 €.",
        replies: 63,
        time: "Hier",
      },
    ],
  },
  {
    id: "cm4",
    name: "Quiet Luxury",
    tagline: "Le luxe sans logo.",
    about:
      "Lemaire, The Row, Margiela : le vestiaire discret qui se reconnaît à la coupe, pas à l'étiquette. Curations, entretien des matières et bons plans dépôt-vente.",
    host: creators.neige,
    members: 7200,
    posts: 540,
    online: 89,
    topics: ["#quietluxury", "#lemaire", "#minimal", "#tailoring"],
    seed: "solange-cm-quiet-luxury",
    memberSeeds: ["neige-77", "maya-d-55", "theo-grail-3"],
    threads: [
      {
        author: "Maya Diallo",
        handle: "maya.curates",
        seed: "maya-d-55",
        title: "Le Croissant bag Lemaire, pièce de fond de vestiaire",
        excerpt:
          "Pourquoi il reste le sac le plus recherché de la maison en seconde main. Vos avis.",
        replies: 39,
        time: "Il y a 1 j",
      },
    ],
  },
];

export function communityById(id: string): Community | undefined {
  return communities.find((c) => c.id === id);
}

/** Communautés déjà rejointes par l'utilisateur courant. */
export const joinedCommunityIds: string[] = ["cm2"];

/* ---------- Éditorial (magazine) ---------- */

export type Article = {
  id: string;
  kind: "focus" | "collection" | "entretien";
  title: string;
  standfirst: string;
  brand?: string;
  creatorHandle?: string;
  seed: string;
  productIds: string[];
  paragraphs: string[];
  readingMin: number;
  date: string;
};

export const articles: Article[] = [
  {
    id: "a1",
    kind: "focus",
    title: "Margiela, l'archive vivante",
    standfirst:
      "Vingt ans après les défilés anonymes de la rue Saint-Maur, les pièces Margiela circulent de dressing en dressing. Portrait d'une maison qui se collectionne comme elle se porte.",
    brand: "Maison Margiela",
    seed: "solange-edito-margiela-a1",
    productIds: ["k2"],
    paragraphs: [
      "Il y a des vêtements qui vieillissent et des vêtements qui mûrissent. Le manteau à épaules structurées de Maison Margiela appartient à la seconde catégorie : chaque passage de main en main ajoute une couche à son histoire, sans jamais entamer sa coupe.",
      "Sur SOLANGE, les pièces Margiela partent en moyenne trois fois plus vite que le reste du vestiaire luxe. Ce n'est pas un hasard. La maison a construit son langage sur la déconstruction, les quatre points de suture blancs, l'anonymat revendiqué. Autant de signes que la seconde main amplifie au lieu de les diluer.",
      "Les collectionneuses le savent : un Margiela d'archive ne s'achète pas pour une saison. Il s'achète pour être transmis. Le dépôt-vente du Marais où Maya Diallo a déniché son manteau en laine ne s'y trompe pas, les pièces des années 1990 et 2000 y sont exposées comme des documents.",
      "Acheter une archive, c'est accepter d'en être le dépositaire temporaire. La patine, les doublures reprises, l'étiquette blanche cousue aux quatre coins : tout raconte le passage du temps. Et c'est précisément ce que le neuf ne pourra jamais offrir.",
    ],
    readingMin: 4,
    date: "2026-07-08",
  },
  {
    id: "a2",
    kind: "collection",
    title: "Le vestiaire gorpcore",
    standfirst:
      "Shell Gore-Tex, banane ripstop, semelle Contagrip : la technique est sortie des sentiers pour s'installer en ville. Trois pièces pour construire un vestiaire outdoor qui dure.",
    seed: "solange-edito-gorpcore-a2",
    productIds: ["k6", "k16", "k7"],
    paragraphs: [
      "Le gorpcore n'est plus une tendance, c'est une grammaire. Née sur les sentiers et adoptée par les capitales, elle repose sur une idée simple : un vêtement conçu pour la montagne survivra sans effort au bitume.",
      "Premier pilier, la veste shell. La Beta d'Arc'teryx en Gore-Tex reste la référence : coupe nette, coutures étanchées, aucune fioriture. En seconde main, elle se trouve autour de 290 euros, soit presque moitié prix du neuf, pour une durée de vie qui se compte en décennies.",
      "Deuxième pilier, l'accessoire porté croisé. La banane ripstop de Patagonia coche toutes les cases : légère, réparable, garantie à vie par la marque. C'est l'exemple parfait de la pièce qui gagne à être achetée d'occasion, puisqu'elle ne s'use presque pas.",
      "Troisième pilier, la chaussure trail. Les XT-6 de Salomon ont fait le pont entre podium et pierrier. Une paire en suède gris, état neuf avec étiquette, circule en ce moment sur SOLANGE. La boucle est bouclée : la technique se recycle aussi bien qu'elle se porte.",
    ],
    readingMin: 3,
    date: "2026-07-05",
  },
  {
    id: "a3",
    kind: "entretien",
    title: "Lou Mercier, chineuse d'archives",
    standfirst:
      "Elle a fait des Puces de Saint-Ouen son bureau et du cuir vieilli sa signature. Rencontre avec la curatrice derrière lou.archive, 24 300 abonnés et un oeil que rien n'échappe.",
    creatorHandle: "lou.archive",
    seed: "solange-edito-lou-a3",
    productIds: ["k1", "k8"],
    paragraphs: [
      "On la croise chaque samedi à l'ouverture du marché Vernaison, thermos à la main. Lou Mercier chine depuis dix ans, documente depuis cinq, revend depuis trois. Sa règle : ne jamais acheter une pièce qu'elle ne porterait pas elle-même.",
      "« La veste motard Acne Studios que je vends en ce moment, je l'ai trouvée sous une pile de blousons sans intérêt. Le cuir était sec, je l'ai nourri pendant deux semaines. C'est ça le travail : voir ce que la pièce peut redevenir, pas ce qu'elle est sur le moment. »",
      "Son fonds de commerce, c'est le vestiaire des années 1990 : cuir patiné, denim brut, tailoring désossé. Le 501 délavé qu'elle propose à 49 euros illustre sa philosophie, une pièce banale en apparence, mais dont le délavage naturel est impossible à reproduire en usine.",
      "« Les gens croient que chiner, c'est trouver la pièce rare. En vrai, c'est surtout dire non quatre-vingt-dix-neuf fois sur cent. La sélection, c'est le seul luxe qui ne s'achète pas. »",
      "Depuis son arrivée sur SOLANGE, Lou vend en direct depuis les allées des Puces. Son prochain live, Cuir & Archive, est déjà l'un des plus attendus de la plateforme.",
    ],
    readingMin: 5,
    date: "2026-07-01",
  },
  {
    id: "a4",
    kind: "focus",
    title: "Cuir : patine et permanence",
    standfirst:
      "Une veste en cuir bien née ne meurt jamais, elle change de propriétaire. Pourquoi le cuir vieilli est devenu la valeur refuge de la seconde main.",
    seed: "solange-edito-cuir-a4",
    productIds: ["k1", "k15"],
    paragraphs: [
      "Le cuir est la seule matière du vestiaire qui s'améliore en s'abîmant. Les plis aux coudes, le grain assoupli, la teinte qui fonce aux points de friction : ce que l'industrie appelle usure, les connaisseurs l'appellent patine.",
      "C'est ce qui explique la cote du cuir en seconde main. Une veste motard Acne Studios affichée 890 euros en boutique se trouve autour de 245 euros après quelques années de vie, avec un supplément d'âme que le neuf n'aura jamais. Le rapport matière-prix est imbattable.",
      "Le tailoring en fait aussi son profit. La veste Helmut Lang de 1999, coupée dans une laine sèche à la structure quasi militaire, dialogue naturellement avec un cuir patiné. Les deux pièces partagent la même promesse : traverser les modes sans se démoder.",
      "Entretenir un cuir demande peu : un lait nourrissant deux fois par an, un cintre large, et de la patience. En échange, la pièce vous survivra. Dans un vestiaire pensé pour durer, c'est le meilleur contrat qui soit.",
    ],
    readingMin: 4,
    date: "2026-06-27",
  },
];
