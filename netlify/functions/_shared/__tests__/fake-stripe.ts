/* Faux client Stripe, en mémoire, pour les tests des versements vendeur
   (D-037). Aucun appel réseau. Il reproduit ce dont le code dépend :
   - comptes connectés et leur calendrier de versement ;
   - solde EUR disponible, suivi PAR source_type, débité à chaque virement
     (un virement sur la mauvaise source échoue, comme chez Stripe) ;
   - virements : liste filtrée par compte et par date (thenable ET
     itérable asynchrone, comme l'auto-pagination du SDK), création
     idempotente — la même clé rejoue le PREMIER résultat, erreur
     comprise, un appel concurrent sur une clé en cours reçoit une
     idempotency_error (HTTP 409), et une clé réutilisée avec d'AUTRES
     paramètres une idempotency_error (HTTP 400), comme chez Stripe ;
   - erreurs levées façon SDK {type, rawType, code, statusCode, message},
     injectables par méthode, une fois ou jusqu'à nouvel ordre.
   `calls` journalise chaque appel avec ses paramètres et ses options
   (stripeAccount, idempotencyKey).

   En fin de fichier : fixtures partagées des tests de versement. */
import { createHash } from "node:crypto";
import { vi, type Mock } from "vitest";
import type { FakeStore } from "./fake-blobs";

/* ---------- erreurs façon SDK ---------- */

export type SdkError = Error & {
  type?: string;
  rawType?: string;
  code?: string;
  statusCode?: number;
};

export function stripeError(o: {
  type?: string;
  rawType?: string;
  code?: string;
  statusCode?: number;
  message?: string;
}): SdkError {
  const e: SdkError = new Error(o.message ?? "Erreur Stripe");
  e.type = o.type;
  e.rawType = o.rawType;
  e.code = o.code;
  e.statusCode = o.statusCode;
  return e;
}

export const ERREURS = {
  idempotence: () =>
    stripeError({
      type: "StripeIdempotencyError",
      rawType: "idempotency_error",
      statusCode: 409,
      message: "Another request with this idempotency key is in progress.",
    }),
  /** Même clé, paramètres différents du premier appel. */
  idempotenceParams: () =>
    stripeError({
      type: "StripeIdempotencyError",
      rawType: "idempotency_error",
      statusCode: 400,
      message:
        "Keys for idempotent requests can only be used with the same parameters they were first used with.",
    }),
  permission: () =>
    stripeError({
      type: "StripePermissionError",
      rawType: "invalid_request_error",
      statusCode: 403,
      message:
        "The provided key does not have the required permissions for this endpoint.",
    }),
  fonds: () =>
    stripeError({
      type: "StripeInvalidRequestError",
      rawType: "invalid_request_error",
      code: "balance_insufficient",
      statusCode: 400,
      message: "Insufficient funds in the balance.",
    }),
  versementsBloques: () =>
    stripeError({
      type: "StripeInvalidRequestError",
      rawType: "invalid_request_error",
      code: "payouts_not_allowed",
      statusCode: 400,
      message: "Payouts are not allowed on this account.",
    }),
  serveur: () =>
    stripeError({
      type: "StripeAPIError",
      rawType: "api_error",
      statusCode: 500,
      message: "Erreur interne simulée",
    }),
};

const estIdempotence = (e: unknown) =>
  (e as SdkError | null)?.rawType === "idempotency_error";

/* ---------- état ---------- */

export type FakeAccount = {
  id: string;
  object: "account";
  settings: { payouts: { schedule: { interval: string } } };
  capabilities: { transfers: string };
  details_submitted: boolean;
};

export type FakePayout = {
  id: string;
  object: "payout";
  amount: number;
  currency: string;
  status: "paid" | "pending" | "in_transit" | "failed" | "canceled";
  created: number; // secondes, comme Stripe
  source_type: string;
  failure_code: string | null;
  description: string | null;
  metadata: Record<string, string>;
  /** Compte connecté qui porte le virement (header Stripe-Account). */
  account: string;
};

export type Methode =
  | "accounts.retrieve"
  | "accounts.update"
  | "accounts.create"
  | "accountLinks.create"
  | "balance.retrieve"
  | "payouts.list"
  | "payouts.create"
  | "payouts.retrieve"
  | "refunds.create"
  | "checkout.sessions.create"
  | "checkout.sessions.retrieve";

export type Appel = {
  method: Methode;
  params: unknown;
  options: { stripeAccount?: string; idempotencyKey?: string } | undefined;
};

export type FakeStripeOptions = {
  accounts?: Array<{ id: string; interval?: string; transfers?: string }>;
  /** Solde EUR disponible ; sans sourceTypes, un seul montant agrégé.
      `pending` : solde EUR encore en attente chez Stripe. */
  balance?: {
    amount: number;
    sourceTypes?: Record<string, number>;
    pending?: number;
  };
  payouts?: Array<Partial<FakePayout> & { id: string }>;
  /** Erreurs levées à CHAQUE appel de la méthode, jusqu'à suppression. */
  errors?: Partial<Record<Methode, SdkError>>;
  /** Horloge des virements créés (secondes = now() / 1000). */
  now?: () => number;
};

type Opts = { stripeAccount?: string; idempotencyKey?: string };

/** Résultat de `payouts.list` : attendu, c'est la première page ;
    parcouru avec `for await`, c'est l'auto-pagination. */
function liste<T>(produire: () => T[]) {
  const page = () => ({
    object: "list" as const,
    data: produire(),
    has_more: false,
    url: "/v1/payouts",
  });
  return {
    then<A = ReturnType<typeof page>, B = never>(
      ok?: ((v: ReturnType<typeof page>) => A | PromiseLike<A>) | null,
      ko?: ((e: unknown) => B | PromiseLike<B>) | null,
    ): Promise<A | B> {
      return Promise.resolve().then(page).then(ok, ko);
    },
    async *[Symbol.asyncIterator]() {
      for (const x of page().data) yield x;
    },
  };
}

export function fakeStripe(opts: FakeStripeOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const state = {
    accounts: new Map<string, FakeAccount>(),
    balance: {
      amount: opts.balance?.amount ?? 0,
      sourceTypes: opts.balance?.sourceTypes
        ? { ...opts.balance.sourceTypes }
        : undefined,
      pending: opts.balance?.pending ?? 0,
    } as {
      amount: number;
      sourceTypes?: Record<string, number>;
      pending?: number;
    },
    payouts: [] as FakePayout[],
    /** Virements réellement créés par ce faux (hors rejeux). */
    created: [] as FakePayout[],
    errors: { ...(opts.errors ?? {}) } as Partial<Record<Methode, SdkError>>,
    once: new Map<Methode, SdkError[]>(),
    idem: new Map<
      string,
      { params: string; payout?: FakePayout; error?: unknown }
    >(),
    inflight: new Set<string>(),
  };
  const calls: Appel[] = [];
  let seq = 0;

  const compte = (id: string, interval = "manual", transfers = "active") =>
    state.accounts.set(id, {
      id,
      object: "account",
      settings: { payouts: { schedule: { interval } } },
      capabilities: { transfers },
      details_submitted: true,
    });
  for (const a of opts.accounts ?? []) compte(a.id, a.interval, a.transfers);
  for (const p of opts.payouts ?? [])
    state.payouts.push({
      object: "payout",
      amount: 0,
      currency: "eur",
      status: "paid",
      created: Math.floor(now() / 1000),
      source_type: "card",
      failure_code: null,
      description: null,
      metadata: {},
      account: "",
      ...p,
    });

  function noter(method: Methode, params: unknown, options?: Opts) {
    calls.push({ method, params, options });
  }
  /** Erreur injectée pour cette méthode : d'abord les « une fois ». */
  function erreur(method: Methode): SdkError | undefined {
    const q = state.once.get(method);
    if (q?.length) return q.shift();
    return state.errors[method];
  }
  function lever(method: Methode) {
    const e = erreur(method);
    if (e) throw e;
  }
  const obtenirCompte = (id: string) => {
    const a = state.accounts.get(id);
    if (!a)
      throw stripeError({
        type: "StripeInvalidRequestError",
        statusCode: 404,
        message: `No such account: '${id}'`,
      });
    return a;
  };
  const dispo = (source: string) =>
    state.balance.sourceTypes
      ? (state.balance.sourceTypes[source] ?? 0)
      : state.balance.amount;

  const client = {
    accounts: {
      retrieve: vi.fn(async (id: string) => {
        noter("accounts.retrieve", id);
        lever("accounts.retrieve");
        return structuredClone(obtenirCompte(id));
      }),
      update: vi.fn(
        async (
          id: string,
          params: {
            settings?: { payouts?: { schedule?: { interval?: string } } };
          },
        ) => {
          noter("accounts.update", { id, ...params });
          lever("accounts.update");
          const a = obtenirCompte(id);
          const interval = params.settings?.payouts?.schedule?.interval;
          if (interval) a.settings.payouts.schedule = { interval };
          return structuredClone(a);
        },
      ),
      create: vi.fn(
        async (
          params: {
            settings?: { payouts?: { schedule?: { interval?: string } } };
          },
          options?: Opts,
        ) => {
          noter("accounts.create", params, options);
          lever("accounts.create");
          const id = `acct_cree${String(++seq).padStart(6, "0")}`;
          compte(
            id,
            params.settings?.payouts?.schedule?.interval ?? "daily",
            "inactive",
          );
          const a = obtenirCompte(id);
          a.details_submitted = false;
          return structuredClone(a);
        },
      ),
    },
    accountLinks: {
      create: vi.fn(async (params: { account: string }) => {
        noter("accountLinks.create", params);
        lever("accountLinks.create");
        return {
          object: "account_link",
          url: `https://connect.stripe.test/${params.account}`,
        };
      }),
    },
    balance: {
      retrieve: vi.fn(async (params?: unknown, options?: Opts) => {
        noter("balance.retrieve", params, options);
        lever("balance.retrieve");
        return {
          object: "balance",
          available: [
            {
              amount: state.balance.amount,
              currency: "eur",
              ...(state.balance.sourceTypes
                ? { source_types: { ...state.balance.sourceTypes } }
                : {}),
            },
          ],
          pending: state.balance.pending
            ? [{ amount: state.balance.pending, currency: "eur" }]
            : [],
        };
      }),
    },
    payouts: {
      list: vi.fn(
        (
          params: { limit?: number; created?: { gte?: number } } = {},
          options?: Opts,
        ) => {
          noter("payouts.list", params, options);
          const e = erreur("payouts.list");
          return liste(() => {
            if (e) throw e;
            return state.payouts
              .filter(
                (p) =>
                  (!options?.stripeAccount ||
                    p.account === options.stripeAccount) &&
                  (params.created?.gte === undefined ||
                    p.created >= params.created.gte),
              )
              .sort((a, b) => b.created - a.created)
              .map((p) => structuredClone(p));
          });
        },
      ),
      create: vi.fn(
        async (
          params: {
            amount: number;
            currency: string;
            source_type?: string;
            description?: string;
            metadata?: Record<string, string>;
          },
          options?: Opts,
        ) => {
          noter("payouts.create", params, options);
          const key = options?.idempotencyKey;
          const empreinte = JSON.stringify(params);
          if (key && state.inflight.has(key)) throw ERREURS.idempotence();
          const rejeu = key ? state.idem.get(key) : undefined;
          if (rejeu && rejeu.params !== empreinte)
            throw ERREURS.idempotenceParams();
          if (rejeu?.payout) return structuredClone(rejeu.payout);
          if (rejeu) throw rejeu.error;
          if (key) state.inflight.add(key);
          try {
            // laisse passer un appel concurrent pendant la requête
            await new Promise((r) => setTimeout(r, 0));
            lever("payouts.create");
            const source = params.source_type ?? "card";
            if (dispo(source) < params.amount) throw ERREURS.fonds();
            if (state.balance.sourceTypes)
              state.balance.sourceTypes[source] -= params.amount;
            state.balance.amount -= params.amount;
            const p: FakePayout = {
              id: `po_${String(++seq).padStart(8, "0")}`,
              object: "payout",
              amount: params.amount,
              currency: params.currency,
              status: "pending",
              created: Math.floor(now() / 1000),
              source_type: source,
              failure_code: null,
              description: params.description ?? null,
              metadata: { ...(params.metadata ?? {}) },
              account: options?.stripeAccount ?? "",
            };
            state.payouts.push(p);
            state.created.push(p);
            if (key) state.idem.set(key, { params: empreinte, payout: p });
            return structuredClone(p);
          } catch (err) {
            if (key && !estIdempotence(err))
              state.idem.set(key, { params: empreinte, error: err });
            throw err;
          } finally {
            if (key) state.inflight.delete(key);
          }
        },
      ),
      retrieve: vi.fn(async (id: string, params?: unknown, options?: Opts) => {
        noter("payouts.retrieve", { id, params }, options);
        lever("payouts.retrieve");
        const p = state.payouts.find(
          (x) =>
            x.id === id &&
            (!options?.stripeAccount || x.account === options.stripeAccount),
        );
        if (!p)
          throw stripeError({
            type: "StripeInvalidRequestError",
            statusCode: 404,
            message: `No such payout: '${id}'`,
          });
        return structuredClone(p);
      }),
    },
    refunds: {
      create: vi.fn(async (params: unknown, options?: Opts) => {
        noter("refunds.create", params, options);
        lever("refunds.create");
        return { id: `re_${String(++seq).padStart(8, "0")}`, object: "refund" };
      }),
    },
    checkout: {
      sessions: {
        create: vi.fn(async (params: unknown, options?: Opts) => {
          noter("checkout.sessions.create", params, options);
          lever("checkout.sessions.create");
          const id = `cs_test_${String(++seq).padStart(8, "0")}`;
          return { id, url: `https://checkout.stripe.test/${id}` };
        }),
        retrieve: vi.fn(async (id: string) => {
          noter("checkout.sessions.retrieve", id);
          lever("checkout.sessions.retrieve");
          return { id, status: "open", payment_status: "unpaid" };
        }),
      },
    },
  };

  return {
    ...client,
    state,
    calls,
    /** Appels d'une méthode, dans l'ordre. */
    callsOf: (m: Methode) => calls.filter((c) => c.method === m),
    /** La prochaine requête de `m` échoue avec `e`, une seule fois. */
    failOnce(m: Methode, e: SdkError) {
      const q = state.once.get(m) ?? [];
      q.push(e);
      state.once.set(m, q);
    },
    /** Change le statut d'un virement existant (payout.failed…). */
    setPayoutStatus(
      id: string,
      status: FakePayout["status"],
      failureCode: string | null = null,
    ) {
      const p = state.payouts.find((x) => x.id === id);
      if (!p) throw new Error(`virement ${id} inconnu`);
      p.status = status;
      p.failure_code = failureCode;
    },
    setBalance(
      amount: number,
      sourceTypes?: Record<string, number>,
      pending = 0,
    ) {
      state.balance = {
        amount,
        sourceTypes: sourceTypes ? { ...sourceTypes } : undefined,
        pending,
      };
    },
  };
}

export type FakeStripe = ReturnType<typeof fakeStripe>;

/* ============================================================
   Fixtures partagées des tests de versement (D-037).
   ============================================================ */

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
/** 28/09/2026 12:00, heure de Paris. */
export const T0 = Date.UTC(2026, 8, 28, 10, 0, 0);

export const ACHETEUSE = "u_aaaaaaaaaaaa";
export const VENDEUR = "u_bbbbbbbbbbbb";
export const ADMIN = "u_cccccccccccc";
export const ADMIN_MAIL = "admin@solange.test";
/** Compte de destination figé sur la commande. */
export const COMPTE = "acct_commande0001";
/** Compte du profil vendeur (repli). */
export const COMPTE_PROFIL = "acct_profil00001";
export const ORDER_ID = "o_000000000001";
export const PRODUCT_ID = "p_000000000001";

/** Commande réelle, en versements manuels, terminée, payée il y a 10 j. */
export function commandeReelle(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    buyerId: ACHETEUSE,
    buyerHandle: "maya.paris",
    productId: PRODUCT_ID,
    brand: "Lemaire",
    name: "Veste croisée",
    sellerHandle: "lou.mercier",
    sellerId: VENDEUR,
    priceEUR: 120,
    protectionEUR: 6,
    shippingEUR: 5.99,
    shippingCents: 599,
    totalEUR: 131.99,
    totalCents: 13199,
    sellerCents: 11399,
    netSellerEUR: 113.99,
    packageSize: "moyen",
    shippingMethodId: "mondial_relay",
    shippingMethod: "Mondial Relay · Point Relais ou Locker",
    payoutMode: "manual",
    sellerStripeAccountId: COMPTE,
    simulated: false,
    paymentIntentId: "pi_0000000001",
    status: "terminee",
    createdAt: T0 - 10 * DAY - HOUR,
    paidAt: T0 - 10 * DAY,
    history: [],
    ...over,
  };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Acheteuse, vendeur (compte Stripe de profil) et administrateur. */
export function preparerComptes(
  users: FakeStore,
  vendeur: Record<string, unknown> = {},
) {
  users.putJSON(`u:${ACHETEUSE}`, {
    id: ACHETEUSE,
    email: "maya@exemple.fr",
    handle: "maya.paris",
    name: "Maya",
  });
  users.putJSON(`u:${VENDEUR}`, {
    id: VENDEUR,
    email: "lou@exemple.fr",
    handle: "lou.mercier",
    name: "Lou",
    stripeAccountId: COMPTE_PROFIL,
    ...vendeur,
  });
  users.putJSON(`u:${ADMIN}`, {
    id: ADMIN,
    email: ADMIN_MAIL,
    handle: "equipe",
    name: "Équipe",
  });
  users.put(`email:${sha256(ADMIN_MAIL)}`, ADMIN);
}

export type Notif = { type: string; text: string; link: string };

export function notifsDe(notifs: FakeStore, uid: string): Notif[] {
  return (notifs.peek(`n:${uid}`) as Notif[] | null) ?? [];
}

export type Email = { to: string; subject: string; html: string };

/** E-mails remis à Resend (fetch mocké). */
export function emailsEnvoyes(fetchMock: Mock<typeof fetch>): Email[] {
  return fetchMock.mock.calls.map(([, init]) => {
    const b = JSON.parse(String(init?.body)) as {
      to: string[];
      subject: string;
      html: string;
    };
    return { to: b.to[0], subject: b.subject, html: b.html };
  });
}
