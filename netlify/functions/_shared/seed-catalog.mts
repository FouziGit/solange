/* Catalogue seed côté serveur — prix de référence pour /api/orders.
   AUTO-EXTRAIT de src/lib/mock.ts (catalog). Le serveur recalcule tous les
   montants à partir de CETTE table, jamais depuis le client. Si mock.ts
   change, régénérer (voir AUDIT.md §5.4). */
export type SeedItem = {
  brand: string; name: string; priceEUR: number;
  size: string; condition: string; seller: string;
};

export const SEED_CATALOG: Record<string, SeedItem> = {
  "k1": {
    "brand": "Acne Studios",
    "name": "Veste motard cuir vieilli",
    "priceEUR": 245,
    "size": "M",
    "condition": "Très bon état",
    "seller": "lou.archive"
  },
  "k2": {
    "brand": "Maison Margiela",
    "name": "Manteau laine épaules structurées",
    "priceEUR": 420,
    "size": "38",
    "condition": "Excellent état",
    "seller": "maya.curates"
  },
  "k3": {
    "brand": "Carhartt WIP",
    "name": "Gilet Detroit doublé sherpa",
    "priceEUR": 95,
    "size": "L",
    "condition": "Très bon état",
    "seller": "samir.fits"
  },
  "k4": {
    "brand": "Jean Paul Gaultier",
    "name": "Chemise mesh imprimé cyber",
    "priceEUR": 340,
    "size": "48",
    "condition": "Très bon état",
    "seller": "theo.grail"
  },
  "k5": {
    "brand": "Pleats Please Issey Miyake",
    "name": "Pantalon plissé technique",
    "priceEUR": 180,
    "size": "2",
    "condition": "Très bon état",
    "seller": "neige.vintage"
  },
  "k6": {
    "brand": "Arc'teryx",
    "name": "Veste shell Gore-Tex Beta",
    "priceEUR": 290,
    "size": "M",
    "condition": "Excellent état",
    "seller": "yuki.paris"
  },
  "k7": {
    "brand": "Salomon",
    "name": "XT-6 suède gris",
    "priceEUR": 110,
    "size": "42",
    "condition": "Neuf avec étiquette",
    "seller": "samir.fits"
  },
  "k8": {
    "brand": "Levi's",
    "name": "501 droit délavé",
    "priceEUR": 49,
    "size": "W30",
    "condition": "Bon état",
    "seller": "lou.archive"
  },
  "k9": {
    "brand": "Prada",
    "name": "Sac nylon Re-Edition 2000",
    "priceEUR": 680,
    "size": "TU",
    "condition": "Très bon état",
    "seller": "maya.curates"
  },
  "k10": {
    "brand": "Comme des Garçons",
    "name": "Cardigan zip laine",
    "priceEUR": 210,
    "size": "M",
    "condition": "Excellent état",
    "seller": "theo.grail"
  },
  "k11": {
    "brand": "Nike",
    "name": "Air Max 90 vintage",
    "priceEUR": 95,
    "size": "41",
    "condition": "Bon état",
    "seller": "nouh.archive"
  },
  "k12": {
    "brand": "Lemaire",
    "name": "Croissant bag cuir",
    "priceEUR": 390,
    "size": "TU",
    "condition": "Très bon état",
    "seller": "maya.curates"
  },
  "k13": {
    "brand": "Dr. Martens",
    "name": "Mary Janes cuir verni",
    "priceEUR": 70,
    "size": "39",
    "condition": "Bon état",
    "seller": "nouh.archive"
  },
  "k14": {
    "brand": "Stüssy",
    "name": "Bonnet côtelé laine",
    "priceEUR": 28,
    "size": "TU",
    "condition": "Bon état",
    "seller": "samir.fits"
  },
  "k15": {
    "brand": "Helmut Lang",
    "name": "Veste tailleur archive 99",
    "priceEUR": 260,
    "size": "40",
    "condition": "Très bon état",
    "seller": "lou.archive"
  },
  "k16": {
    "brand": "Patagonia",
    "name": "Banane ripstop noire",
    "priceEUR": 35,
    "size": "TU",
    "condition": "Bon état",
    "seller": "nouh.archive"
  },
  "k17": {
    "brand": "Oakley Vintage",
    "name": "Lunettes ovales métal",
    "priceEUR": 65,
    "size": "TU",
    "condition": "Bon état",
    "seller": "nouh.archive"
  }
};

/** Commission dégressive SOLANGE — miroir de src/lib/utils.ts (BP). */
export function commissionRate(price: number): number {
  if (price < 200) return 0.04;
  if (price < 500) return 0.035;
  if (price < 1000) return 0.025;
  return 0.02;
}
