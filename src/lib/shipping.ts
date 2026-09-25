/* ============================================================
   SOLANGE — livraison (checkout)
   Options transporteur choisies AVANT paiement (façon Vinted /
   Vestiaire Collective) : Mondial Relay, Point Relais, Chronopost.
   Les points relais sont SIMULÉS (générés depuis le code postal) — une
   vraie API/widget transporteur (Mondial Relay, Boxtal, Sendcloud) se
   branche ici plus tard. Aucun appel réseau externe pour l'instant.
   ============================================================ */

export type ShipMethodId = "mondial_relay" | "point_relais" | "chronopost";

export type ShipOption = {
  id: ShipMethodId;
  carrier: string;
  /** Sous-titre : type de remise (point relais / domicile). */
  label: string;
  priceEUR: number;
  eta: string;
  /** true = nécessite le choix d'un point relais. */
  relay: boolean;
  /** Localisateur officiel du transporteur : là où l'acheteur trouve un
      VRAI point relais tant qu'aucune API transporteur n'est branchée. */
  locator?: string;
};

/** Barème unique — miroir côté serveur (netlify/functions/orders.mts). */
export const SHIP_OPTIONS: ShipOption[] = [
  {
    id: "mondial_relay",
    carrier: "Mondial Relay",
    label: "Point relais",
    priceEUR: 3.9,
    eta: "4–6 j ouvrés",
    relay: true,
    locator:
      "https://www.mondialrelay.fr/trouver-le-point-relais-le-plus-proche-de-chez-moi/",
  },
  {
    id: "point_relais",
    carrier: "Point Relais",
    label: "Réseau Pickup",
    priceEUR: 4.5,
    eta: "2–4 j ouvrés",
    relay: true,
    locator: "https://www.pickup.fr/trouver-un-point/",
  },
  {
    id: "chronopost",
    carrier: "Chronopost",
    label: "À domicile · express",
    priceEUR: 6.9,
    eta: "24–48 h",
    relay: false,
  },
];

export function shipOption(id: ShipMethodId): ShipOption {
  return SHIP_OPTIONS.find((o) => o.id === id) ?? SHIP_OPTIONS[0];
}

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
    domicile, un libellé résiduel (relais choisi avant de passer en
    Chronopost) est ignoré. */
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
