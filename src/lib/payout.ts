/* ============================================================
   SOLANGE — versement au vendeur après livraison (D-037). Fonctions PURES
   à horloge injectée, lues par le front (notes affichées) et par
   netlify/functions (_shared/payout.mts, orders-cron, admin).

   Les comptes vendeurs sont en versements MANUELS : la part du vendeur
   reste sur son solde Stripe jusqu'à `terminee` (réception confirmée,
   clôture J+14 ou litige tranché pour le vendeur), puis un versement
   par commande part vers sa banque. Stripe garde les fonds 90 jours au
   plus (FR) : versement d'office à J+80 hors litige, alertes à J+80 et
   J+85 sur les litiges et contestations bancaires. Ce n'est PAS un
   séquestre : SOLANGE ne détient pas les fonds.
   ============================================================ */

import type { OrderStatus } from "./order-state";

export type PayoutStatus = "en_attente_fonds" | "envoye" | "simule" | "erreur";

export type OrderPayout = {
  status: PayoutStatus;
  amountCents: number;
  /** Id du payout Stripe (po_…) une fois envoyé. */
  id?: string;
  /** Envoi (ou simulation) du versement. */
  at?: number;
  /** Passages non simulés (tentatives, réussies ou non). */
  attempts: number;
  /** Échecs de `payouts.create` : suffixe de la clé d'idempotence. */
  createTries: number;
  lastAttemptAt?: number;
  lastError?: string;
  /** Dernière alerte admin (garde de 24 h). */
  alertedAt?: number;
  /** Versé d'office à J+80, avant `terminee`. */
  forced?: boolean;
  /** Dernière vérification du statut chez Stripe (payout.failed). */
  checkedAt?: number;
  /** source_type Stripe utilisé (card, bank_account…). */
  sourceType?: string;
};

const DAY = 86_400_000;

export const PAYOUT_DELAYS = {
  retryMs: DAY, // nouvel essai au plus une fois par jour
  forceAfterPaidMs: 80 * DAY, // versement d'office hors litige
  urgentAfterPaidMs: 85 * DAY, // alerte URGENT
  stripeHoldMaxMs: 90 * DAY, // limite Stripe des versements manuels (FR)
  disputeLongMs: 7 * DAY, // litige ouvert depuis longtemps : une alerte
  alertEveryMs: DAY, // alertes litige au plus une fois par jour
  verifyWindowMs: 15 * DAY, // on surveille un versement envoyé 15 jours
  verifyEveryMs: DAY, // une vérification par jour
} as const;

export type PayoutInput = {
  status: OrderStatus;
  sellerId: string | null;
  payoutMode?: unknown;
  simulated?: unknown;
  paidAt?: number;
  createdAt: number;
  payout?: OrderPayout | null;
  dispute?: { at: number } | null;
  bankDispute?: { at: number } | null;
  disputeAlertAt?: number;
};

export type PayoutAction =
  | { kind: "none" }
  | { kind: "pay"; forced: boolean; urgent: boolean }
  | { kind: "verify" }
  | { kind: "alert_dispute"; urgency: "long" | "j80" | "j85"; bank: boolean };

/** Statuts où le versement d'office à J+80 est permis : pièce expédiée,
    sans litige. Jamais `payee` (rien n'est parti : l'annulation J+7 doit
    rembourser l'acheteur, pas payer le vendeur) ni `litige` (l'équipe
    tranche d'abord). Lu par payoutAction, _shared/payout.mts et admin. */
export const FORCED_PAYOUT_STATUSES: readonly OrderStatus[] = [
  "expediee",
  "recue",
];

/** Point de départ des délais : le paiement confirmé, sinon la création. */
export function payoutBase(
  o: Pick<PayoutInput, "paidAt" | "createdAt">,
): number {
  return o.paidAt ?? o.createdAt;
}

const NONE: PayoutAction = { kind: "none" };

/** Ce que le cron doit faire MAINTENANT pour le versement d'une commande.
    Règles dans l'ordre (D-037) : hors périmètre → rien ; versement déjà
    parti → vérification quotidienne 15 jours ; contestation bancaire →
    jamais de versement, alertes à J+80/J+85 ; terminée → versement ;
    expédiée sans litige à J+80 → versement d'office ; litige → alertes.
    Une commande `payee` (jamais expédiée) n'est jamais versée d'office :
    le cron l'annule à J+7 et prévient l'équipe si l'annulation échoue. */
export function payoutAction(o: PayoutInput, now: number): PayoutAction {
  if (
    !o.sellerId ||
    o.payoutMode !== "manual" ||
    o.status === "en_attente" ||
    o.status === "annulee"
  )
    return NONE;

  const p = o.payout ?? null;
  if (p?.status === "simule") return NONE;
  if (p?.status === "envoye") {
    /* Versé d'office (J+80) puis litige ouvert : l'alerte « long » part
       quand même, avant la vérification du virement. */
    if (o.status === "litige" && longDispute(o, now))
      return { kind: "alert_dispute", urgency: "long", bank: false };
    const due =
      p.at !== undefined &&
      now - p.at <= PAYOUT_DELAYS.verifyWindowMs &&
      now - (p.checkedAt ?? p.at) >= PAYOUT_DELAYS.verifyEveryMs;
    return due ? { kind: "verify" } : NONE;
  }

  const age = now - payoutBase(o);
  const late = age >= PAYOUT_DELAYS.forceAfterPaidMs;
  const retryOk = !p || now - (p.lastAttemptAt ?? 0) >= PAYOUT_DELAYS.retryMs;
  const alertOk =
    !o.disputeAlertAt || now - o.disputeAlertAt >= PAYOUT_DELAYS.alertEveryMs;
  const urgency = age >= PAYOUT_DELAYS.urgentAfterPaidMs ? "j85" : "j80";

  if (o.bankDispute)
    return late && alertOk
      ? { kind: "alert_dispute", urgency, bank: true }
      : NONE;

  if (o.status === "terminee")
    return retryOk ? { kind: "pay", forced: false, urgent: late } : NONE;

  if (FORCED_PAYOUT_STATUSES.includes(o.status))
    return late && retryOk ? { kind: "pay", forced: true, urgent: true } : NONE;

  if (o.status === "litige") {
    if (late && alertOk) return { kind: "alert_dispute", urgency, bank: false };
    if (longDispute(o, now))
      return { kind: "alert_dispute", urgency: "long", bank: false };
  }
  return NONE;
}

/** Litige ouvert depuis 7 jours sans alerte encore envoyée. */
function longDispute(o: PayoutInput, now: number): boolean {
  return (
    !!o.dispute &&
    now - o.dispute.at >= PAYOUT_DELAYS.disputeLongMs &&
    !o.disputeAlertAt
  );
}

/** Relance admin d'un versement (bouton « Réessayer ») : possible sur une
    commande terminée, ou en versement d'office sur une commande expédiée
    à J+80. Sinon (payée, litige, annulée, expédiée avant J+80), rien ne
    partirait : le bouton n'est pas proposé. La contestation bancaire se
    décide à part (forçage explicite). */
export function adminPayoutRetry(
  o: Pick<PayoutInput, "status" | "paidAt" | "createdAt">,
  now: number,
): { ok: boolean; force: boolean } {
  if (o.status === "terminee") return { ok: true, force: false };
  const late = now - payoutBase(o) >= PAYOUT_DELAYS.forceAfterPaidMs;
  if (late && FORCED_PAYOUT_STATUSES.includes(o.status))
    return { ok: true, force: true };
  return { ok: false, force: false };
}

/** Part du vendeur en centimes : `sellerCents` (commandes récentes),
    sinon `netSellerEUR` arrondi, sinon 0 (montant introuvable). */
export function payoutAmountCents(o: {
  sellerCents?: unknown;
  netSellerEUR?: unknown;
}): number {
  if (
    typeof o.sellerCents === "number" &&
    Number.isInteger(o.sellerCents) &&
    o.sellerCents > 0
  )
    return o.sellerCents;
  if (typeof o.netSellerEUR === "number" && Number.isFinite(o.netSellerEUR)) {
    const cents = Math.round(o.netSellerEUR * 100);
    if (cents > 0) return cents;
  }
  return 0;
}

/* ---------- erreurs Stripe ---------- */

export type PayoutOp = "schedule" | "balance" | "read" | "payout";

export type PayoutErrorKind =
  "fonds" | "permission" | "compte" | "concurrent" | "autre";

/** Permission à ajouter à la clé restreinte, selon l'appel qui a échoué. */
const PERMISSION_BY_OP: Readonly<Record<PayoutOp, string>> = {
  schedule: "Connect › Accounts (écriture)",
  balance: "Balance (lecture)",
  read: "Connect › Payouts (lecture)",
  payout: "Connect › Payouts (écriture)",
};

/** Erreur du SDK Stripe → catégorie et message lisible par l'admin. */
export function classifyPayoutError(
  e: {
    code?: string;
    statusCode?: number;
    type?: string;
    rawType?: string;
    message?: string;
  },
  op: PayoutOp,
): { kind: PayoutErrorKind; message: string } {
  const detail = e.message ?? "";
  if (
    e.type === "StripeIdempotencyError" ||
    e.rawType === "idempotency_error" ||
    e.statusCode === 409
  )
    return {
      kind: "concurrent",
      message: "Versement déjà en cours de traitement",
    };
  if (e.code === "balance_insufficient")
    return {
      kind: "fonds",
      message: "Fonds pas encore disponibles chez Stripe",
    };
  if (e.code === "payouts_not_allowed")
    return {
      kind: "compte",
      message:
        "Versements désactivés sur le compte Stripe du vendeur (inscription à compléter)",
    };
  if (
    e.statusCode === 403 ||
    e.type === "StripePermissionError" ||
    /permission/i.test(detail)
  )
    return {
      kind: "permission",
      message: `Clé Stripe restreinte sans l'autorisation nécessaire : ajouter ${PERMISSION_BY_OP[op]}. Détail Stripe : ${detail.slice(0, 200)}`,
    };
  return {
    kind: "autre",
    message: detail.slice(0, 300) || "Erreur Stripe sans message",
  };
}

/* ---------- affichage (page commande, e-mails) ---------- */

/* Aligné sur les CGV, art. 12.5 : le vendeur est payé après la
   réception, confirmée par l'acheteur ou constatée par la clôture
   automatique à J+14 sans problème signalé. */
export const BUYER_PROTECTION_TEXT =
  "Ton paiement est protégé : le vendeur n'est payé qu'après la réception, que tu la confirmes ou que 14 jours passent après l'expédition sans problème signalé de ta part.";

export const SELLER_PAYOUT_TEXT =
  "Tu es payé dès que l'acheteur confirme la réception, ou 14 jours après l'expédition sans problème signalé.";

/** Commande de démonstration (paiement simulé, CGV art. 2) : aucun
    virement réel, ni protection d'un paiement qui n'a pas eu lieu. */
export const SIMULATED_PAYOUT_TEXT =
  "Paiement simulé (démonstration) : aucun virement réel n'aura lieu.";

/** « 29 septembre 2026 », à l'heure de Paris. */
export function formatPayoutDate(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(ms));
}

/** Note « Versement » (vendeur) ou « Protection » (acheteur) de la page
    commande. null = rien à afficher (commande antérieure sans
    versement par commande, annulée, ou paiement non confirmé). Commande
    simulée sans versement : texte de démonstration côté vendeur. */
export function payoutNote(
  o: {
    status: OrderStatus;
    payoutMode?: unknown;
    simulated?: unknown;
    payout?: OrderPayout | null;
    lostParcel?: unknown;
    bankDispute?: unknown;
  },
  role: "buyer" | "seller",
): string | null {
  if (o.status === "annulee" || o.payoutMode !== "manual") return null;
  const seller = role === "seller";
  const p = o.payout ?? null;
  const paid = p?.status === "envoye" || p?.status === "simule";

  /* Démonstration : ni virement à annoncer, ni paiement à protéger. */
  if (o.simulated === true && !paid && o.status !== "en_attente")
    return seller ? SIMULATED_PAYOUT_TEXT : null;

  if (o.bankDispute && !paid)
    return seller
      ? "Ton virement est suspendu : l'acheteur a contesté le paiement auprès de sa banque. L'équipe te tient au courant."
      : null;

  /* Un versement existe : seul le vendeur en est informé. */
  switch (p?.status) {
    case "envoye":
      if (!seller) return null;
      return p.at !== undefined
        ? `Virement envoyé le ${formatPayoutDate(p.at)}`
        : "Virement envoyé";
    case "simule":
      return seller ? "Virement simulé (démonstration)" : null;
    case "en_attente_fonds":
      return seller
        ? "Ta part est prête : le virement part dès que Stripe rend les fonds disponibles. On réessaie chaque jour."
        : null;
    case "erreur":
      return seller
        ? "Virement retardé : l'équipe est prévenue et s'en occupe."
        : null;
  }

  switch (o.status) {
    case "terminee":
      return seller ? "Virement en préparation" : null;
    case "litige":
      return seller
        ? "Ton virement attend la décision de l'équipe."
        : BUYER_PROTECTION_TEXT;
    case "payee":
    case "expediee":
    case "recue":
      return seller ? SELLER_PAYOUT_TEXT : BUYER_PROTECTION_TEXT;
    default:
      return null;
  }
}
