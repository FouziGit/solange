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
  },
  {
    id: "point_relais",
    carrier: "Point Relais",
    label: "Réseau Pickup",
    priceEUR: 4.5,
    eta: "2–4 j ouvrés",
    relay: true,
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
