/* ============================================================
   SOLANGE — versement au vendeur APRÈS la livraison (D-037).

   Les comptes vendeurs sont en versements MANUELS : avec une destination
   charge, la part du vendeur arrive sur SON solde Stripe au paiement et
   y reste (SOLANGE ne détient rien : ce n'est pas un séquestre). Quand la
   commande est terminée — réception confirmée, clôture J+14 ou litige
   tranché pour le vendeur —, UN virement par commande part vers sa
   banque. Règles de décision (quand payer, quand alerter) : fonctions
   pures de src/lib/payout.ts ; ici, seulement les appels Stripe.

   Idempotence, dans cet ordre :
   - réconciliation : un virement Stripe portant metadata.orderId (hors
     failed/canceled) vaut « envoyé », sans nouvelle création ;
   - clé d'idempotence payout-<id>, suffixée -<n> après chaque échec de
     création (Stripe rejoue le PREMIER résultat, erreur comprise, 24 h) ;
   - écriture conditionnelle (patchOrder) qui n'écrase jamais un
     versement déjà « envoyé » ou « simulé ».

   AUCUNE fonction ne lève d'exception : un versement raté est noté sur la
   commande, signalé aux administrateurs, et repris par le cron.
   ============================================================ */
import type Stripe from "stripe";
import { pushNotif, store } from "./core.mts";
import { stripe } from "./stripe.mts";
import { alerterAdmins } from "./admin-alert.mts";
import { patchOrder, type OrderRecord } from "./order-core.mts";
import { emitOrderEvent } from "./order-events.mts";
import { normalizeStatus } from "../../../src/lib/order-state.ts";
import {
  FORCED_PAYOUT_STATUSES,
  PAYOUT_DELAYS,
  classifyPayoutError,
  payoutAmountCents,
  payoutBase,
  type OrderPayout,
  type PayoutErrorKind,
  type PayoutOp,
} from "../../../src/lib/payout.ts";

const DAY = 86_400_000;

type ErreurStripe = {
  code?: string;
  statusCode?: number;
  type?: string;
  rawType?: string;
  message?: string;
};

/** Champs utiles d'une erreur du SDK Stripe (ou de n'importe quoi). */
function erreurStripe(e: unknown): ErreurStripe {
  if (!e || typeof e !== "object") return { message: String(e) };
  const r = e as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    code: str(r.code),
    statusCode: typeof r.statusCode === "number" ? r.statusCode : undefined,
    type: str(r.type),
    rawType: str(r.rawType),
    message: str(r.message),
  };
}

function journaliser(tag: string, id: string, e: unknown) {
  const x = erreurStripe(e);
  console.error(tag, id, x.code ?? "", x.message ?? "");
}

/** 1234 → « 12,34 € ». */
const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

const estVerse = (p: OrderPayout | null | undefined) =>
  p?.status === "envoye" || p?.status === "simule";

async function lireCommande(id: string): Promise<OrderRecord | null> {
  return (await store("orders").get(`o:${id}`, {
    type: "json",
  })) as OrderRecord | null;
}

/** Compte de destination du transfert, figé sur la commande ; à défaut
    (commande sans le champ), celui du profil vendeur. */
async function compteVendeur(o: OrderRecord): Promise<string | null> {
  if (typeof o.sellerStripeAccountId === "string" && o.sellerStripeAccountId)
    return o.sellerStripeAccountId;
  if (!o.sellerId) return null;
  const u = (await store("users").get(`u:${o.sellerId}`, {
    type: "json",
  })) as { stripeAccountId?: unknown } | null;
  return typeof u?.stripeAccountId === "string" && u.stripeAccountId
    ? u.stripeAccountId
    : null;
}

/* ---------- versements manuels sur le compte du vendeur ---------- */

/** Somme EUR d'une liste de soldes Stripe (available ou pending). */
const totalEur = (l: readonly { currency: string; amount: number }[] = []) =>
  l.filter((a) => a.currency === "eur").reduce((n, a) => n + a.amount, 0);

/** Passe le compte connecté en versements MANUELS s'il ne l'est pas
    (comptes créés avant D-037 : hebdomadaires). Juste après la bascule, le
    solde du compte n'est rattaché à aucune commande en versement par
    commande : disponible OU encore en attente chez Stripe (ventes
    antérieures payées depuis peu), il est signalé aux administrateurs,
    jamais versé automatiquement. */
export async function assurerVersementsManuels(
  accountId: string,
  acct?: Stripe.Account | null,
): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const s = stripe();
  if (!s) return { ok: true, changed: false };
  try {
    const a = acct ?? (await s.accounts.retrieve(accountId));
    if (a.settings?.payouts?.schedule?.interval === "manual")
      return { ok: true, changed: false };
    await s.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
  } catch (e) {
    journaliser("payout_schedule_error", accountId, e);
    return {
      ok: false,
      error: classifyPayoutError(erreurStripe(e), "schedule").message,
    };
  }

  try {
    const bal = await s.balance.retrieve({}, { stripeAccount: accountId });
    const dispo = totalEur(bal.available);
    const attente = totalEur(bal.pending);
    const montants = [
      ...(dispo > 0 ? [`${eur(dispo)} disponibles`] : []),
      ...(attente > 0 ? [`${eur(attente)} en attente chez Stripe`] : []),
    ];
    if (montants.length)
      await alerterAdmins({
        text: `Compte ${accountId} basculé en versements manuels avec ${montants.join(" et ")} non rattachés à une commande : à verser à la main depuis le Dashboard Stripe${attente > 0 ? " (la part en attente, une fois devenue disponible)" : ""}`,
        link: "/admin",
        subject: "SOLANGE — solde vendeur à verser à la main",
      });
  } catch (e) {
    journaliser("payout_schedule_error", accountId, e);
    await alerterAdmins({
      text: `Compte ${accountId} basculé en versements manuels, mais son solde n'a pas pu être lu : vérifier dans le Dashboard Stripe qu'aucun montant antérieur n'attend d'être versé`,
      link: "/admin",
      subject: "SOLANGE — solde vendeur à vérifier",
    });
  }
  return { ok: true, changed: true };
}

/** La clé Stripe peut-elle lire le solde et les virements du compte ?
    Lecture seule. La permission Payouts en ÉCRITURE ne se vérifie pas sans
    écrire : elle figure dans la liste de vérification avant déploiement. */
export async function verifierAccesVersements(
  accountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = stripe();
  if (!s) return { ok: true };
  let op: PayoutOp = "balance";
  try {
    await s.balance.retrieve({}, { stripeAccount: accountId });
    op = "read";
    await s.payouts.list({ limit: 1 }, { stripeAccount: accountId });
    return { ok: true };
  } catch (e) {
    journaliser("payout_error", accountId, e);
    return {
      ok: false,
      error: classifyPayoutError(erreurStripe(e), op).message,
    };
  }
}

/* ---------- versement d'une commande ---------- */

/** Ordre de préférence des soldes Stripe (suivis par source_type). */
const SOURCES_PREFEREES = ["card", "bank_account"];

type ChoixSource =
  { ok: true; source?: string } | { ok: false; disponible: number };

/** Solde EUR disponible → source qui couvre le montant. Stripe tient un
    solde par source_type : sans source suffisante, pas de virement. */
function choisirSource(
  available: Stripe.Balance.Available[],
  montant: number,
): ChoixSource {
  let disponible = 0;
  for (const a of available) {
    if (a.currency !== "eur") continue;
    const parSource = (a.source_types ?? {}) as Record<
      string,
      number | undefined
    >;
    const cles = Object.keys(parSource);
    if (!cles.length) {
      if (a.amount >= montant) return { ok: true };
      disponible = Math.max(disponible, a.amount);
      continue;
    }
    const ordre = [
      ...SOURCES_PREFEREES.filter((k) => cles.includes(k)),
      ...cles.filter((k) => !SOURCES_PREFEREES.includes(k)),
    ];
    for (const k of ordre) {
      const v = parSource[k] ?? 0;
      if (v >= montant) return { ok: true, source: k };
      disponible = Math.max(disponible, v);
    }
  }
  return { ok: false, disponible };
}

/** Une commande relue est-elle (encore) à verser ? Terminée ; ou, en
    versement d'office (J+80), expédiée sans litige. Jamais pendant une
    contestation bancaire, sauf décision admin. Relu AVANT la création du
    virement : un litige ouvert pendant les appels Stripe l'arrête. */
function aVerser(o: OrderRecord | null, opts: VerserOptions): o is OrderRecord {
  if (!o || !o.sellerId || o.payoutMode !== "manual") return false;
  const status = normalizeStatus(o.status);
  const ouvert =
    status === "terminee" ||
    (opts.force === true && FORCED_PAYOUT_STATUSES.includes(status));
  if (!ouvert) return false;
  return !o.bankDispute || opts.admin === true;
}

type Effets = {
  /** Texte de l'alerte admin (garde de 24 h déjà appliquée). */
  alerte?: string;
  /** Prévenir le vendeur que son inscription Stripe bloque le virement. */
  compteVendeur?: boolean;
  /** Ce passage fait passer à « envoyé » : événement « verse ». */
  verse?: boolean;
};

/** Écrit le versement sur la version fraîche (seul le champ payout
    change), puis déclenche ses effets. Un versement déjà envoyé ou simulé
    n'est jamais écrasé : il est rendu tel quel, sans effet.
    Un virement PARTI alors que la commande est passée entre-temps en
    litige ou annulée : l'argent a bougé, l'état le dit (et, annulée et
    remboursée, `refundAfterPayout`), et l'équipe est prévenue. Un échec
    sur une commande annulée entre-temps n'a plus d'objet : rien n'est
    écrit. */
async function enregistrer(
  o: OrderRecord,
  payout: OrderPayout,
  effets: Effets = {},
): Promise<OrderPayout | null> {
  const etat: {
    deja: OrderPayout | null;
    abandon: boolean;
    horsCycle: string | null;
  } = { deja: null, abandon: false, horsCycle: null };
  const r = await patchOrder(o.id, (fresh) => {
    etat.deja = estVerse(fresh.payout) ? (fresh.payout ?? null) : null;
    if (etat.deja) return null;
    const status = normalizeStatus(fresh.status);
    const envoye = payout.status === "envoye";
    etat.abandon = !envoye && status === "annulee";
    if (etat.abandon) return null;
    etat.horsCycle =
      envoye && (status === "litige" || status === "annulee") ? status : null;
    return {
      ...fresh,
      payout,
      ...(envoye &&
      status === "annulee" &&
      fresh.refundId &&
      !fresh.refundAfterPayout
        ? { refundAfterPayout: { at: payout.at ?? Date.now() } }
        : {}),
    };
  });
  if (!r.ok) {
    // Le cron repassera ; un virement déjà créé sera retrouvé par la
    // réconciliation (metadata.orderId).
    console.error("payout_error", o.id, "write", r.reason);
    return null;
  }
  if (etat.deja) return etat.deja;
  if (etat.abandon) return null;

  if (etat.horsCycle)
    await alerterAdmins({
      text: `Virement vendeur parti alors que la commande ${o.id} est passée en « ${etat.horsCycle} » : ${
        etat.horsCycle === "annulee"
          ? "l'acheteur est remboursé et la part a été virée, solde vendeur négatif (SOLANGE en répond)"
          : "trancher le litige en tenant compte de la part déjà virée"
      }`,
      link: "/admin",
      subject: "SOLANGE — virement parti pendant un litige ou une annulation",
    });

  if (effets.alerte)
    await alerterAdmins({
      text: effets.alerte,
      link: "/admin",
      subject: "SOLANGE — versement vendeur en échec",
    });
  if (effets.compteVendeur && o.sellerId)
    await pushNotif(o.sellerId, {
      type: "order",
      text: "Ton virement attend : termine ton inscription Stripe dans ton profil",
      link: "/profil",
    });
  if (effets.verse) await emitOrderEvent(r.order, "verse");
  return payout;
}

export type VerserOptions = {
  /** Versement d'office à J+80, avant `terminee` : expédiée ou reçue,
      jamais payée ni en litige (FORCED_PAYOUT_STATUSES). */
  force?: boolean;
  /** Décision admin : verser malgré une contestation bancaire. */
  admin?: boolean;
  now?: number;
};

type Tentative =
  | { ok: true; payout: OrderPayout }
  | { ok: false; kind: PayoutErrorKind; message: string; creation: boolean }
  /** La commande n'est plus à verser (litige, annulation, contestation
      survenus pendant les appels Stripe) : rien n'est créé ni écrit. */
  | { ok: false; kind: "hors_perimetre" };

/** Verse au vendeur la part d'une commande terminée (ou forcée). Rend le
    versement noté sur la commande, ou null quand il n'y a rien à verser
    (hors périmètre) ou que l'écriture a échoué. */
export async function verserVendeur(
  orderId: string,
  opts: VerserOptions = {},
): Promise<OrderPayout | null> {
  try {
    return await verser(orderId, opts);
  } catch (e) {
    journaliser("payout_error", orderId, e);
    return null;
  }
}

async function verser(
  orderId: string,
  opts: VerserOptions,
): Promise<OrderPayout | null> {
  const now = opts.now ?? Date.now();

  // 1. périmètre, relu sur la version fraîche
  const o = await lireCommande(orderId);
  if (!aVerser(o, opts)) return null;
  const prev = o.payout ?? null;
  if (prev && estVerse(prev)) return prev;

  const amountCents = payoutAmountCents(o);
  const attempts = (prev?.attempts ?? 0) + 1;
  const createTries = prev?.createTries ?? 0;
  const urgent = now - payoutBase(o) >= PAYOUT_DELAYS.forceAfterPaidMs;

  /* Échec : « en attente de fonds » (on réessaie chaque jour, alerte
     seulement à J+80) ou « erreur » (alerte). Alertes gardées 24 h. */
  const echec = (
    kind: PayoutErrorKind,
    message: string,
    creation = false,
  ): Promise<OrderPayout | null> => {
    const fonds = kind === "fonds";
    const alerter =
      (!fonds || urgent) &&
      (!prev?.alertedAt || now - prev.alertedAt >= PAYOUT_DELAYS.alertEveryMs);
    return enregistrer(
      o,
      {
        status: fonds ? "en_attente_fonds" : "erreur",
        amountCents,
        attempts,
        createTries: createTries + (creation ? 1 : 0),
        lastAttemptAt: now,
        lastError: message,
        ...(alerter
          ? { alertedAt: now }
          : prev?.alertedAt !== undefined
            ? { alertedAt: prev.alertedAt }
            : {}),
      },
      {
        alerte: alerter
          ? `Versement vendeur en échec — commande ${o.id} : ${message}`
          : undefined,
        compteVendeur: alerter && kind === "compte",
      },
    );
  };

  // 2. montant
  if (amountCents <= 0) return echec("autre", "Montant vendeur introuvable");

  // 3. démonstration : jamais d'appel Stripe, jamais de notification
  if (o.simulated === true)
    return enregistrer(o, {
      status: "simule",
      amountCents,
      at: now,
      attempts,
      createTries,
    });
  /* Commande RÉELLE sans clé Stripe : l'argent existe chez Stripe, on ne
     le déclare jamais « simulé ». Erreur, alerte, nouvel essai demain. */
  const s = stripe();
  if (!s) return echec("autre", "Clé Stripe absente : versement impossible");

  // 4. compte du vendeur
  const account = await compteVendeur(o);
  if (!account)
    return echec("autre", "Compte de paiement du vendeur introuvable");

  const t = await tenter(s, o, account, {
    amountCents,
    attempts,
    createTries,
    now,
    force: opts.force === true,
    encoreAVerser: async () => aVerser(await lireCommande(o.id), opts),
  });
  if (t.ok) return enregistrer(o, t.payout, { verse: true });
  if (t.kind === "hors_perimetre") return null;
  if (t.kind === "concurrent") {
    // Un autre passage crée ce même virement : il l'écrira. Rien ici.
    return (await lireCommande(o.id))?.payout ?? null;
  }
  // Toute création ratée change de clé : Stripe rejouerait l'erreur 24 h.
  return echec(t.kind, t.message, t.creation);
}

/** Étapes 5 à 7 : réconciliation, solde, création. Les erreurs Stripe
    sont classées selon l'appel qui a échoué ; rien n'est écrit ici. */
async function tenter(
  s: Stripe,
  o: OrderRecord,
  stripeAccount: string,
  c: {
    amountCents: number;
    attempts: number;
    createTries: number;
    now: number;
    force: boolean;
    /** Relecture de la commande juste avant la création du virement. */
    encoreAVerser: () => Promise<boolean>;
  },
): Promise<Tentative> {
  let op: PayoutOp = "read";
  try {
    // 5. réconciliation : un virement déjà créé pour cette commande ?
    const depuis = Math.floor((payoutBase(o) - DAY) / 1000);
    for await (const p of s.payouts.list(
      { limit: 100, created: { gte: depuis } },
      { stripeAccount },
    )) {
      if (
        p.metadata?.orderId === o.id &&
        p.status !== "failed" &&
        p.status !== "canceled"
      )
        return {
          ok: true,
          payout: {
            status: "envoye",
            amountCents: c.amountCents,
            id: p.id,
            at: p.created * 1000,
            attempts: c.attempts,
            createTries: c.createTries,
            lastAttemptAt: c.now,
            ...(c.force ? { forced: true } : {}),
            ...(p.source_type ? { sourceType: p.source_type } : {}),
          },
        };
    }

    // 6. solde disponible, par source
    op = "balance";
    const bal = await s.balance.retrieve({}, { stripeAccount });
    const choix = choisirSource(bal.available, c.amountCents);
    if (!choix.ok)
      return {
        ok: false,
        kind: "fonds",
        message: `Fonds pas encore disponibles chez Stripe (disponible ${eur(choix.disponible)}, requis ${eur(c.amountCents)})`,
        creation: false,
      };

    /* 7. création — la commande est relue d'abord : un litige ouvert, une
       annulation ou une contestation survenus pendant les appels
       précédents arrêtent le virement avant qu'il ne parte. */
    if (!(await c.encoreAVerser()))
      return { ok: false, kind: "hors_perimetre" };
    op = "payout";
    const p = await s.payouts.create(
      {
        amount: c.amountCents,
        currency: "eur",
        ...(choix.source ? { source_type: choix.source } : {}),
        description: `SOLANGE ${o.id}`.slice(0, 350),
        metadata: { orderId: o.id },
      },
      {
        stripeAccount,
        idempotencyKey:
          c.createTries === 0
            ? `payout-${o.id}`
            : `payout-${o.id}-${c.createTries}`,
      },
    );
    return {
      ok: true,
      payout: {
        status: "envoye",
        amountCents: c.amountCents,
        id: p.id,
        at: c.now,
        attempts: c.attempts,
        createTries: c.createTries,
        lastAttemptAt: c.now,
        forced: c.force,
        ...(choix.source || p.source_type
          ? { sourceType: choix.source ?? p.source_type }
          : {}),
      },
    };
  } catch (e) {
    journaliser("payout_error", o.id, e);
    const k = classifyPayoutError(erreurStripe(e), op);
    return { ...k, ok: false, creation: op === "payout" };
  }
}

/* ---------- vérification d'un virement envoyé ---------- */

/** Un virement « envoyé » peut échouer plus tard (IBAN refusé…). Pendant
    15 jours, le cron relit son statut chaque jour : failed/canceled →
    erreur, vendeur et administrateurs prévenus, et nouvel essai le
    lendemain avec une nouvelle clé (la réconciliation ignore l'échec). */
export async function verifierVersement(
  orderId: string,
  now: number = Date.now(),
): Promise<OrderPayout | null> {
  try {
    return await verifier(orderId, now);
  } catch (e) {
    journaliser("payout_verify_error", orderId, e);
    return null;
  }
}

async function verifier(
  orderId: string,
  now: number,
): Promise<OrderPayout | null> {
  const o = await lireCommande(orderId);
  const p = o?.payout ?? null;
  if (!o || !p || p.status !== "envoye" || !p.id) return p;
  const s = stripe();
  const account = await compteVendeur(o);
  if (!s || !account) return p;

  let next: OrderPayout = { ...p, checkedAt: now };
  let echoue = false;
  try {
    const po = await s.payouts.retrieve(p.id, {}, { stripeAccount: account });
    if (po.status === "failed" || po.status === "canceled") {
      echoue = true;
      // l'id du virement échoué disparaît : le prochain essai en crée un autre
      const { id: idEchoue, ...sansId } = p;
      void idEchoue;
      next = {
        ...sansId,
        status: "erreur",
        lastError: `Virement ${po.status}${po.failure_code ? ` (${po.failure_code})` : ""}`,
        createTries: p.createTries + 1,
        checkedAt: now,
        // nouvel essai le lendemain : le vendeur a le temps de corriger
        lastAttemptAt: now,
        alertedAt: now,
      };
    }
  } catch (e) {
    // lecture impossible : on réessaiera demain, sans marteler Stripe
    journaliser("payout_verify_error", o.id, e);
  }

  const etat = { applique: false };
  const r = await patchOrder(o.id, (fresh) => {
    etat.applique =
      fresh.payout?.status === "envoye" && fresh.payout.id === p.id;
    return etat.applique ? { ...fresh, payout: next } : null;
  });
  if (!r.ok) {
    console.error("payout_verify_error", o.id, "write", r.reason);
    return p;
  }
  if (!etat.applique) return r.order.payout ?? null;

  if (echoue) {
    if (o.sellerId)
      await pushNotif(o.sellerId, {
        type: "order",
        text: "Ton virement a échoué : vérifie ton compte bancaire dans ton espace Stripe (Profil › Paiements)",
        link: "/profil",
      });
    await alerterAdmins({
      text: `Versement vendeur en échec — commande ${o.id} : ${next.lastError}. Nouvel essai automatique dans 24 h.`,
      link: "/admin",
      subject: "SOLANGE — versement vendeur en échec",
    });
  }
  return next;
}
