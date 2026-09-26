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

export const looks: Look[] = [];

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
  /** Annonce d'un membre : son compte et sa photo. Absents en démo. */
  sellerId?: string | null;
  sellerAvatar?: string | null;
  likes: number;
  span?: boolean; // tall tile in the masonry
};

export const catalog: CatalogItem[] = [];

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
export const savedIds: string[] = [];

export const savedItems: CatalogItem[] = savedIds
  .map((id) => catalogItem(id))
  .filter((it): it is CatalogItem => it !== undefined);

/** Handles the current user follows (drives the "Suivis" feed tab). */
export const followedHandles: string[] = [];

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

export const drops: Drop[] = [];

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

export const notifications: Notif[] = [];

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
  /** Une commande existe sur la pièce de ce fil (lot 1). */
  orderId?: string;
  time: string;
  unread: number;
  messages: Message[];
};

export const conversations: Conversation[] = [];

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
export const commentsByLook: Record<string, Comment[]> = {};

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

export const streams: Stream[] = [];

/* ---------- Communautés (cercles créateurs) ---------- */

export type Community = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  host: Creator;
  members: number;
  topics: string[];
  seed: string;
  /** Avatars de membres mis en avant (aperçu de la pile). */
  memberSeeds: string[];
};

export const communities: Community[] = [];

export function communityById(id: string): Community | undefined {
  return communities.find((c) => c.id === id);
}

/** Communautés déjà rejointes par l'utilisateur courant. */
export const joinedCommunityIds: string[] = [];

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

export const articles: Article[] = [];
