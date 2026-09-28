/* ============================================================
   SOLANGE — livraison (SSOT front + serveur, D-037)
   Un seul transporteur : Mondial Relay, en Point Relais ou Locker, ou à
   domicile. Le port suit la GRILLE PUBLIQUE Mondial Relay (particuliers,
   TTC, France) selon la taille du colis, choisie par le vendeur au dépôt
   de l'annonce puis figée. Ce fichier est lu par le front (dépôt,
   checkout, commande) ET par netlify/functions (montant payé, e-mails) :
   une seule grille, jamais de montant venu du client.
   Ajouter un transporteur = une ligne dans CARRIERS + SHIP_OPTIONS +
   SHIPPING_GRID_CENTS.
   Les points relais de la liste de démo sont SIMULÉS (générés depuis le
   code postal) ; en paiement réel, l'acheteur recopie un vrai point
   trouvé sur le localisateur officiel. Aucun appel réseau ici.
   ============================================================ */

/* ---------- taille du colis (choisie par le vendeur, figée) ---------- */

export type PackageSizeId = "petit" | "moyen" | "grand" | "tres_grand";

export type PackageSize = {
  id: PackageSizeId;
  label: string;
  /** Poids maximal du colis emballé, en grammes. */
  maxWeightG: number;
  examples: string;
};

export const PACKAGE_SIZES: readonly PackageSize[] = [
  {
    id: "petit",
    label: "Petit",
    maxWeightG: 500,
    examples: "tee-shirt, accessoire, bijou, petit flacon",
  },
  {
    id: "moyen",
    label: "Moyen",
    maxWeightG: 1000,
    examples: "jean, chemise, sac à main",
  },
  {
    id: "grand",
    label: "Grand",
    maxWeightG: 2000,
    examples: "manteau, baskets, gros pull",
  },
  {
    id: "tres_grand",
    label: "Très grand",
    maxWeightG: 4000,
    examples: "bottes, manteau lourd",
  },
];

/** Repli des annonces antérieures (sans taille) et des pièces seed. */
export const DEFAULT_PACKAGE_SIZE: PackageSizeId = "moyen";

export const PACKAGE_WEIGH_HINT =
  "Pèse ta pièce emballée : c'est le poids du colis qui compte. La taille ne se change plus après la mise en vente.";

/* Table indexée : Object.hasOwn ne voit que les clés déclarées, jamais
   « __proto__ », « toString » ou « constructor » hérités du prototype. */
const SIZE_BY_ID: Readonly<Record<PackageSizeId, PackageSize>> = {
  petit: PACKAGE_SIZES[0],
  moyen: PACKAGE_SIZES[1],
  grand: PACKAGE_SIZES[2],
  tres_grand: PACKAGE_SIZES[3],
};

export function isPackageSize(v: unknown): v is PackageSizeId {
  return typeof v === "string" && Object.hasOwn(SIZE_BY_ID, v);
}

/** Taille lue sur une annonce ou une commande : absente ou invalide →
    "moyen" (annonces antérieures, seed). Pas de migration de masse. */
export function packageSizeOf(v: unknown): PackageSizeId {
  return isPackageSize(v) ? v : DEFAULT_PACKAGE_SIZE;
}

export function packageSize(id: PackageSizeId): PackageSize {
  return SIZE_BY_ID[packageSizeOf(id)];
}

/** 500 → « 500 g », 1000 → « 1 kg », 1500 → « 1,5 kg ». */
export function weightLabel(g: number): string {
  if (g < 1000) return `${g} g`;
  return `${(g / 1000).toLocaleString("fr-FR")} kg`;
}

/* ---------- transporteurs ---------- */

export type CarrierId = "mondial_relay";

export type Carrier = {
  id: CarrierId;
  name: string;
  /** Plafond d'indemnisation en cas de perte, en centimes : c'est le
      transporteur qui indemnise le vendeur (il détient le contrat de
      transport), jamais SOLANGE (D-037). */
  lossCompensationCents: number;
  lossCompensationSource: { url: string; checkedAt: string };
  /** Service client où le vendeur déclare la perte. */
  claimUrl: string;
  /** Page officielle de suivi, SANS paramètre. */
  trackingUrl: string;
  /** Aide affichée sous le champ « Numéro de suivi ». */
  trackingHint: string;
};

/* Indemnisation forfaitaire incluse dans le tarif MR : 25 € (perte
   confirmée / avarie, emballage conforme).
   Source : https://www.mondialrelay.fr/envoi-de-colis/assurer-mon-colis/
   relevée le 28/09/2026.
   trackingUrl SANS paramètre : le pré-remplissage ?parcelNumber=&zipCode=
   ne marche pas (testé le 28/09/2026). */
export const CARRIERS: Readonly<Record<CarrierId, Carrier>> = {
  mondial_relay: {
    id: "mondial_relay",
    name: "Mondial Relay",
    lossCompensationCents: 2500,
    lossCompensationSource: {
      url: "https://www.mondialrelay.fr/envoi-de-colis/assurer-mon-colis/",
      checkedAt: "2026-09-28",
    },
    claimUrl: "https://www.mondialrelay.fr/contact-clients-particuliers/",
    trackingUrl: "https://www.mondialrelay.fr/suivi-de-colis/",
    trackingHint: "Le numéro à 8 chiffres de ton étiquette Mondial Relay",
  },
};

/* ---------- modes de livraison et grille ---------- */

/** "mondial_relay" garde son id (commandes et brouillons existants). */
export type ShipMethodId = "mondial_relay" | "mondial_relay_domicile";

export type ShipOption = {
  id: ShipMethodId;
  carrierId: CarrierId;
  carrier: string;
  /** Sous-titre : type de remise (point relais / domicile). */
  label: string;
  eta: string;
  /** true = nécessite le choix d'un point relais. */
  relay: boolean;
  /** Localisateur officiel du transporteur : là où l'acheteur trouve un
      VRAI point relais tant qu'aucune API transporteur n'est branchée. */
  locator?: string;
  /** @deprecated plus lu par le code après le lot 4 ; = prix « Moyen » de
      la grille, conservé pour garder tsc vert entre les lots. Ne pas
      utiliser : le port dépend de la taille (shippingCents). */
  priceEUR: number;
};

/* Tarif public Mondial Relay particuliers, TTC, envois en France.
   Source : https://www.mondialrelay.fr/envoi-de-colis/tarifs-expeditions/
   grille « applicable au 15 juin 2026 », relevée le 28/09/2026. Le palier
   0,25 kg est ignoré : « Petit » va jusqu'à 500 g.
   Lue par le front ET par netlify/functions/orders.mts (montant payé). */
export const SHIPPING_GRID_CENTS: Readonly<
  Record<ShipMethodId, Readonly<Record<PackageSizeId, number>>>
> = {
  mondial_relay: { petit: 415, moyen: 599, grand: 799, tres_grand: 999 },
  mondial_relay_domicile: {
    petit: 749,
    moyen: 949,
    grand: 1099,
    tres_grand: 1639,
  },
};

export const SHIPPING_GRID_SOURCE = {
  url: "https://www.mondialrelay.fr/envoi-de-colis/tarifs-expeditions/",
  applicableFrom: "2026-06-15",
  checkedAt: "2026-09-28",
} as const;

export const SHIP_OPTIONS: ShipOption[] = [
  {
    id: "mondial_relay",
    carrierId: "mondial_relay",
    carrier: "Mondial Relay",
    label: "Point Relais ou Locker",
    eta: "3–5 j ouvrés",
    relay: true,
    locator:
      "https://www.mondialrelay.fr/trouver-le-point-relais-le-plus-proche-de-chez-moi/",
    priceEUR: SHIPPING_GRID_CENTS.mondial_relay.moyen / 100,
  },
  {
    id: "mondial_relay_domicile",
    carrierId: "mondial_relay",
    carrier: "Mondial Relay",
    label: "À domicile",
    /* « 3 à 5 jours ouvrés » en France métropolitaine, selon l'extrait
       indexé de https://www.mondialrelay.fr/comment-envoyer-un-colis-a-domicile-avec-mondial-relay/
       (recherche du 28/09/2026 ; la page elle-même refuse la lecture
       directe, 403). À relire sur la page avant de le changer. */
    eta: "3–5 j ouvrés",
    relay: false,
    priceEUR: SHIPPING_GRID_CENTS.mondial_relay_domicile.moyen / 100,
  },
];

export function isShipMethod(v: unknown): v is ShipMethodId {
  return typeof v === "string" && Object.hasOwn(SHIPPING_GRID_CENTS, v);
}

export function shipOption(id: ShipMethodId): ShipOption {
  return SHIP_OPTIONS.find((o) => o.id === id) ?? SHIP_OPTIONS[0];
}

/** « Mondial Relay · Point Relais ou Locker » / « Mondial Relay · À domicile ». */
export function shipMethodLabel(id: ShipMethodId): string {
  const o = shipOption(id);
  return `${o.carrier} · ${o.label}`;
}

/** Port payé par l'acheteur, en centimes : grille × taille figée. */
export function shippingCents(
  method: ShipMethodId,
  size: PackageSizeId,
): number {
  return SHIPPING_GRID_CENTS[shipOption(method).id][packageSizeOf(size)];
}

/** Port le moins cher pour cette taille (le relais) → « envoi dès X € ». */
export function shippingFromCents(size: PackageSizeId): number {
  return Math.min(...SHIP_OPTIONS.map((o) => shippingCents(o.id, size)));
}

/** Transporteur d'une commande : par son mode (commandes récentes), sinon
    par son libellé historique « Mondial Relay ». Les libellés des anciens
    transporteurs retirés (commandes antérieures) → null : aucune donnée
    transporteur fiable. */
export function carrierOfOrder(o: {
  shippingMethodId?: unknown;
  shippingMethod?: unknown;
}): Carrier | null {
  if (isShipMethod(o.shippingMethodId))
    return CARRIERS[shipOption(o.shippingMethodId).carrierId];
  if (
    typeof o.shippingMethod === "string" &&
    o.shippingMethod.includes(CARRIERS.mondial_relay.name)
  )
    return CARRIERS.mondial_relay;
  return null;
}

/* ---------- numéro de suivi (obligatoire pour expédier) ---------- */

export const TRACKING_MIN = 6;
export const TRACKING_MAX = 40;

const TRACKING_RE = new RegExp(
  `^[A-Za-z0-9]{${TRACKING_MIN},${TRACKING_MAX}}$`,
);

/** Numéro saisi → forme normalisée (sans espaces, tirets ni points, en
    majuscules). Contrôle de FORMAT seulement : rien ne prouve que le colis
    existe (écart assumé, D-037). Le motif est testé AVANT la mise en
    majuscules : « ß » ou « ı » ne passent pas en devenant « SS » ou « I ». */
export function validateTracking(
  raw: unknown,
): { ok: true; tracking: string } | { ok: false; error: string } {
  const error =
    "Indique le numéro de suivi de ton étiquette (6 à 40 lettres ou chiffres).";
  if (typeof raw !== "string") return { ok: false, error };
  const cleaned = raw.replace(/[\s.-]/g, "");
  if (!TRACKING_RE.test(cleaned)) return { ok: false, error };
  return { ok: true, tracking: cleaned.toUpperCase() };
}

/* ---------- points relais ---------- */

export type RelayPoint = {
  id: string;
  name: string;
  address: string;
  postal: string;
  distance: string;
  hours: string;
};

const SHOPS = [
  "Tabac de la Gare",
  "Carrefour City",
  "Presse du Marché",
  "Franprix",
  "Relais Pickup — Le Balto",
  "Boulangerie Saint-Honoré",
  "Pharmacie du Centre",
];
const STREETS = [
  "rue de la République",
  "avenue Jean-Jaurès",
  "rue du Commerce",
  "boulevard Voltaire",
  "place du Marché",
  "rue Victor-Hugo",
];

/** Simulated relay points near a postal code — deterministic so the list is
 *  stable for a given code. Real carrier API plugs in here later. */
export function relayPointsNear(postal: string): RelayPoint[] {
  const digits = postal.replace(/\D/g, "");
  const seed = digits ? [...digits].reduce((a, c) => a + Number(c), 0) : 3;
  return Array.from({ length: 5 }).map((_, i) => {
    const shop = SHOPS[(seed + i) % SHOPS.length];
    const street = STREETS[(seed + i * 2) % STREETS.length];
    const num = ((seed * 7 + i * 13) % 90) + 1;
    return {
      id: `relay-${i}`,
      name: shop,
      address: `${num} ${street}`,
      postal,
      distance: `${(0.2 + i * 0.35).toFixed(1)} km`,
      hours: i % 2 === 0 ? "Lun–Sam · 8h–20h" : "Lun–Sam · 9h–19h30",
    };
  });
}

/* ---------- point relais retenu (client ET serveur) ----------
   Les points ci-dessus sont FACTICES : en paiement réel, l'acheteur
   paierait pour un relais qui n'existe pas. Il cherche donc le sien sur le
   localisateur officiel du transporteur et en recopie les coordonnées ;
   le vendeur y déposera le colis. netlify/functions/orders.mts importe
   ces fonctions : une seule règle des deux côtés. */

/** Point relais retenu : un point de la liste de démo, ou un point
    saisi à la main (id MANUAL_RELAY_ID). */
export type RelayChoice = {
  id: string;
  name: string;
  address: string;
  postal: string;
  city?: string;
};

export const MANUAL_RELAY_ID = "manuel";

/** Longueur maximale du libellé point relais gardé sur la commande. */
export const RELAY_LABEL_MAX = 160;

/** Longueurs maximales des champs saisis à la main. Ensemble, séparateurs
    compris (« nom — adresse, CP ville »), elles tiennent dans
    RELAY_LABEL_MAX : la ville n'est jamais coupée. */
export const RELAY_FIELD_MAX = {
  name: 45,
  address: 70,
  postal: 5,
  city: 34,
} as const;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** « 12 rue du Commerce, 75011 Paris » */
export function relayAddressLine(p: Omit<RelayChoice, "id" | "name">): string {
  const town = squash(`${p.postal} ${p.city ?? ""}`);
  return [squash(p.address), town].filter(Boolean).join(", ");
}

/** Libellé envoyé au serveur et lu par le vendeur :
    « Tabac de la Gare — 12 rue du Commerce, 75011 Paris ». */
export function relayLabelFor(p: Omit<RelayChoice, "id">): string {
  return [squash(p.name), relayAddressLine(p)]
    .filter(Boolean)
    .join(" — ")
    .slice(0, RELAY_LABEL_MAX);
}

export type ManualRelayField = "name" | "address" | "postal" | "city";

/** Saisie manuelle → point relais, ou le premier champ à corriger. */
export function parseManualRelay(
  input: Record<ManualRelayField, string>,
):
  | { ok: true; relay: RelayChoice }
  | { ok: false; field: ManualRelayField; message: string } {
  const name = squash(input.name);
  const address = squash(input.address);
  const postal = input.postal.replace(/\s/g, "");
  const city = squash(input.city);
  if (!name)
    return {
      ok: false,
      field: "name",
      message: "Indique le nom du point relais.",
    };
  if (!address)
    return {
      ok: false,
      field: "address",
      message: "Indique l'adresse du point relais.",
    };
  if (!/^\d{5}$/.test(postal))
    return {
      ok: false,
      field: "postal",
      message: "Le code postal compte 5 chiffres.",
    };
  if (!city)
    return {
      ok: false,
      field: "city",
      message: "Indique la ville du point relais.",
    };
  return {
    ok: true,
    relay: {
      id: MANUAL_RELAY_ID,
      name: name.slice(0, RELAY_FIELD_MAX.name),
      address: address.slice(0, RELAY_FIELD_MAX.address),
      postal,
      city: city.slice(0, RELAY_FIELD_MAX.city),
    },
  };
}

/** Vrai si ce mode de livraison passe par un point relais. */
export function isRelayMethod(method: string): boolean {
  return SHIP_OPTIONS.some((o) => o.id === method && o.relay);
}

/** Contrôle du point relais d'une commande. En point relais, il est
    OBLIGATOIRE : sans lui, le vendeur ne sait pas où déposer le colis. À
    domicile, un libellé résiduel (relais choisi avant de passer à la
    livraison à domicile) est ignoré. */
export function validateRelay(
  method: string,
  relayLabel: unknown,
): { ok: true; label: string } | { ok: false; error: string } {
  if (!isRelayMethod(method)) return { ok: true, label: "" };
  const label =
    typeof relayLabel === "string"
      ? squash(relayLabel).slice(0, RELAY_LABEL_MAX).trimEnd()
      : "";
  return label
    ? { ok: true, label }
    : { ok: false, error: "Choisis un point relais" };
}
