/* ============================================================
   SOLANGE — règles d'envoi des push (lot 3). Fonctions PURES,
   partagées client (affichage des réglages) / serveur (décision
   d'envoi). Horloge injectée — testées dans __tests__/push-rules.
   ============================================================ */

/** Types d'événements poussables — miroir des types de la cloche. */
export type PushType =
  "sale" | "order" | "message" | "circle" | "follow" | "like" | "report";

export const PUSH_TYPES: PushType[] = [
  "sale",
  "order",
  "message",
  "circle",
  "follow",
  "like",
  "report",
];

/** Libellés des réglages — la personne doit comprendre ce qu'elle coupe. */
export const PUSH_LABELS: Record<PushType, string> = {
  sale: "Mes ventes",
  order: "Suivi de mes commandes",
  message: "Messages",
  circle: "Réponses dans les Cercles",
  follow: "Nouveaux abonnés",
  like: "J'aime sur mes pièces",
  report: "Modération",
};

export type PushPrefs = {
  enabled: boolean;
  types: Record<PushType, boolean>;
  /** Heures calmes, format 0–23. quietFrom > quietTo = plage qui passe minuit. */
  quietFrom: number;
  quietTo: number;
};

/* 22 h → 8 h : on ne réveille personne pour une vente. Modifiable. */
export const DEFAULT_PREFS: PushPrefs = {
  enabled: true,
  types: {
    sale: true,
    order: true,
    message: true,
    circle: true,
    follow: true,
    like: true,
    report: true,
  },
  quietFrom: 22,
  quietTo: 8,
};

/** Plafond horaire : au-delà, l'événement reste dans la cloche. */
export const HOURLY_CAP = 8;
/** Fenêtre de regroupement d'événements de même nature. */
export const GROUP_WINDOW_MS = 10 * 60_000;

/** Préférences telles qu'elles peuvent sortir du stockage : incomplètes
    (enregistrement écrit avant l'ajout d'un type), voire absentes. */
export type StoredPrefs = Partial<Omit<PushPrefs, "types">> & {
  types?: Partial<Record<PushType, boolean>>;
};

/** Complète des préférences partielles (stockage ancien ou vide). */
export function normalizePrefs(raw: StoredPrefs | null): PushPrefs {
  return {
    enabled: raw?.enabled ?? DEFAULT_PREFS.enabled,
    types: { ...DEFAULT_PREFS.types, ...(raw?.types ?? {}) },
    quietFrom: raw?.quietFrom ?? DEFAULT_PREFS.quietFrom,
    quietTo: raw?.quietTo ?? DEFAULT_PREFS.quietTo,
  };
}

/** Heure locale (Paris) dans les heures calmes ? */
export function inQuietHours(prefs: PushPrefs, hour: number): boolean {
  const { quietFrom: from, quietTo: to } = prefs;
  if (from === to) return false; // plage vide = jamais silencieux
  return from < to
    ? hour >= from && hour < to // 1 h → 6 h
    : hour >= from || hour < to; // 22 h → 8 h (passe minuit)
}

export type PushDecision =
  | { send: true; grouped: boolean }
  | { send: false; reason: "disabled" | "type" | "quiet" | "cap" };

/** LA décision d'envoi. Le serveur ne pousse que si elle dit oui. */
export function decidePush(
  prefs: PushPrefs,
  type: PushType,
  ctx: {
    hour: number;
    /** Push déjà envoyés dans l'heure en cours. */
    sentThisHour: number;
    /** Un événement de même tag est-il en cours de regroupement ? */
    grouping?: boolean;
  },
): PushDecision {
  if (!prefs.enabled) return { send: false, reason: "disabled" };
  if (!prefs.types[type]) return { send: false, reason: "type" };
  if (inQuietHours(prefs, ctx.hour)) return { send: false, reason: "quiet" };
  if (ctx.sentThisHour >= HOURLY_CAP) return { send: false, reason: "cap" };
  return { send: true, grouped: ctx.grouping === true };
}

/** Texte d'un lot regroupé : « 3 personnes ont aimé ta pièce ». */
export function groupedText(type: PushType, count: number): string {
  if (count <= 1) return "";
  const n = count;
  switch (type) {
    case "like":
      return `${n} personnes ont aimé ta pièce`;
    case "message":
      return `${n} nouveaux messages`;
    case "circle":
      return `${n} réponses dans tes Cercles`;
    case "follow":
      return `${n} nouveaux abonnés`;
    case "sale":
      return `${n} ventes`;
    case "order":
      return `${n} mises à jour de commande`;
    case "report":
      return `${n} signalements à traiter`;
  }
}
