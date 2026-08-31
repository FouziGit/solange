/* ============================================================
   SOLANGE — machine à états de la commande (SSOT, lot 1).
   Importée par le CLIENT (frise, libellés, actions affichées) et
   par le SERVEUR (netlify/functions — validation des transitions,
   cron). Le client ne décide jamais : il AFFICHE ce que cette
   table autorise, le serveur REVALIDE avec la même table.
   Fonctions pures à horloge injectée — testées dans
   src/lib/__tests__/order-state.test.ts.
   ============================================================ */

export type OrderStatus =
  "payee" | "expediee" | "recue" | "terminee" | "annulee" | "litige";

export type OrderAction =
  | "ship" // vendeur : j'ai expédié
  | "cancel" // vendeur (motif) ou système (délai) : annulation avant envoi
  | "receive" // acheteur : bien reçu (→ recue, puis clôture immédiate)
  | "dispute" // acheteur : non reçue / non conforme
  | "close" // système : clôture (après réception, ou silence prolongé)
  | "resolve_cancel" // admin (lot 4) : litige tranché → annulée
  | "resolve_close"; // admin (lot 4) : litige tranché → terminée

export type OrderRole = "buyer" | "seller" | "system" | "admin";

/** Anciennes valeurs → nouveau vocabulaire. Mapping EN LECTURE : aucune
    réécriture de masse (les commandes existantes disaient "confirmee"). */
export function normalizeStatus(raw: string | undefined): OrderStatus {
  if (raw === "confirmee" || raw === undefined) return "payee";
  return raw as OrderStatus;
}

/** Qui peut faire quoi, depuis quel statut, vers quel statut. */
const TRANSITIONS: Record<
  OrderAction,
  { from: OrderStatus[]; to: OrderStatus; roles: OrderRole[] }
> = {
  ship: { from: ["payee"], to: "expediee", roles: ["seller"] },
  cancel: { from: ["payee"], to: "annulee", roles: ["seller", "system"] },
  receive: { from: ["expediee"], to: "recue", roles: ["buyer"] },
  dispute: { from: ["expediee", "recue"], to: "litige", roles: ["buyer"] },
  close: { from: ["recue", "expediee"], to: "terminee", roles: ["system"] },
  resolve_cancel: { from: ["litige"], to: "annulee", roles: ["admin"] },
  resolve_close: { from: ["litige"], to: "terminee", roles: ["admin"] },
};

/** Statut d'arrivée si la transition est permise, sinon null. */
export function nextStatus(
  status: OrderStatus,
  action: OrderAction,
  role: OrderRole,
): OrderStatus | null {
  const t = TRANSITIONS[action];
  if (!t) return null;
  if (!t.from.includes(status)) return null;
  if (!t.roles.includes(role)) return null;
  return t.to;
}

/* ---------- délais des automatismes (D-016) ----------
   Repère marché : Vinted annule à 7 jours sans expédition — c'est le
   comportement que nos utilisateurs connaissent. Après expédition, pas de
   suivi transporteur réel en beta → clôture large à 14 jours (2× le délai
   postal courant), rappel à mi-course. */
const DAY = 24 * 60 * 60 * 1000;
export const DELAYS = {
  remindShipMs: 3 * DAY, // rappel vendeur : J+3 après paiement
  autoCancelMs: 7 * DAY, // annulation auto : J+7 sans expédition
  remindReceiveMs: 7 * DAY, // rappel acheteur : J+7 après expédition
  autoCloseMs: 14 * DAY, // clôture auto : J+14 après expédition
} as const;

export type DueAction =
  "remind_ship" | "auto_cancel" | "remind_receive" | "auto_close";

/** Ce que le cron doit faire MAINTENANT pour une commande donnée.
    Pure : horloge injectée, idempotence par les marqueurs remind*At. */
export function dueActions(
  o: {
    status: OrderStatus;
    createdAt: number;
    shippedAt?: number;
    remindShipAt?: number;
    remindReceiveAt?: number;
  },
  now: number,
): DueAction[] {
  const due: DueAction[] = [];
  if (o.status === "payee") {
    if (now - o.createdAt >= DELAYS.autoCancelMs) due.push("auto_cancel");
    else if (now - o.createdAt >= DELAYS.remindShipMs && !o.remindShipAt)
      due.push("remind_ship");
  }
  if (o.status === "expediee" && o.shippedAt) {
    if (now - o.shippedAt >= DELAYS.autoCloseMs) due.push("auto_close");
    else if (now - o.shippedAt >= DELAYS.remindReceiveMs && !o.remindReceiveAt)
      due.push("remind_receive");
  }
  // litige / recue / terminee / annulee : le cron ne touche à rien.
  return due;
}

/* ---------- affichage (client + emails) ---------- */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  payee: "Payée",
  expediee: "Expédiée",
  recue: "Reçue",
  terminee: "Terminée",
  annulee: "Annulée",
  litige: "Litige",
};

/** La frise nominale de la page commande. */
export const TIMELINE: OrderStatus[] = [
  "payee",
  "expediee",
  "recue",
  "terminee",
];

export type OrderHistoryEntry = {
  at: number;
  by: string; // userId | "system" | "admin"
  from: OrderStatus | "creee";
  to: OrderStatus;
  note?: string;
};
