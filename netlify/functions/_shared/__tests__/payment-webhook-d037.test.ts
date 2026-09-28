import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type Stripe from "stripe";
import webhook from "../../payment-webhook.mts";
import { verserVendeur } from "../payout.mts";
import type { OrderRecord } from "../order-core.mts";
import { payoutAction } from "../../../../src/lib/payout.ts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ADMIN,
  COMPTE,
  DAY,
  ORDER_ID,
  PRODUCT_ID,
  T0,
  VENDEUR,
  commandeReelle,
  emailsEnvoyes,
  fakeStripe,
  notifsDe,
  preparerComptes,
  type FakeStripe,
} from "./fake-stripe";

/* Webhook Stripe et D-037 : la contestation bancaire suspend le virement
   au vendeur, elle est donc écrite par écriture CONDITIONNELLE (jamais à
   l'aveugle par-dessus un virement, un remboursement ou un changement de
   statut concurrent) ; sa clôture (charge.dispute.closed) lève la
   suspension quand elle est gagnée, la garde et prévient l'équipe quand
   elle est perdue. Le rattachement du paiement (paymentIntentId) suit la
   même règle. Signature simulée, Stripe simulé, stockage en mémoire. */

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
  stripe: null as unknown,
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

vi.mock("../stripe.mts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  stripe: () => h.stripe as Stripe | null,
  paymentsLive: () => h.stripe !== null,
}));

const PI = "pi_0000000001";
const DISPUTE = "dp_0000000001";

let orders: FakeStore;
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;
/** Statut de la contestation relue chez Stripe. */
let statutContestation: string;
/** Session Checkout relue chez Stripe. */
let session: Record<string, unknown>;

const poser = (over: Record<string, unknown> = {}) =>
  orders.putJSON(`o:${ORDER_ID}`, commandeReelle(over));
const lue = () => orders.peek(`o:${ORDER_ID}`) as OrderRecord;
const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");

/** Un autre écrivain passe juste avant la PREMIÈRE écriture de la commande. */
function ecrivainConcurrent(modif: Record<string, unknown>) {
  let fait = false;
  orders.beforeWrite = (key) => {
    if (fait || key !== `o:${ORDER_ID}`) return;
    fait = true;
    orders.putJSON(key, { ...(orders.peek(key) as object), ...modif });
  };
}

async function evenement(type: string, object: Record<string, unknown>) {
  const res = await webhook(
    new Request("https://solange.test/api/payment/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=signature-simulee" },
      body: JSON.stringify({ id: `evt_${type}`, type, data: { object } }),
    }),
  );
  return { status: res.status, body: (await res.json()) as object };
}

const contestation = (type: "created" | "closed") =>
  evenement(`charge.dispute.${type}`, { id: DISPUTE, object: "dispute" });

const envoye = {
  status: "envoye",
  amountCents: 11399,
  id: "po_concurrent",
  at: T0,
  attempts: 1,
  createTries: 0,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("ADMIN_EMAILS", "admin@solange.test");
  fetchMock = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const stores = fakeStores();
  h.stores = stores;
  orders = stores("orders");
  notifs = stores("notifs");
  preparerComptes(stores("users"));
  stores("products").putJSON(`p:${PRODUCT_ID}`, {
    id: PRODUCT_ID,
    sellerId: VENDEUR,
    status: "reserved",
    reservedBy: ORDER_ID,
  });

  statutContestation = "needs_response";
  session = {};
  fake = fakeStripe({
    accounts: [{ id: COMPTE }],
    balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
  });
  h.stripe = {
    ...fake,
    webhooks: {
      constructEventAsync: vi.fn(async (raw: string) => JSON.parse(raw)),
    },
    disputes: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        object: "dispute",
        payment_intent: PI,
        reason: "fraudulent",
        amount: 13199,
        status: statutContestation,
      })),
    },
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        metadata: { orderId: ORDER_ID },
      })),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(async (id: string) => ({ id, ...session })),
      },
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("charge.dispute.created — écriture conditionnelle", () => {
  it("un virement écrit au même moment n'est pas effacé : les deux restent", async () => {
    poser();
    ecrivainConcurrent({ payout: envoye });

    expect(await contestation("created")).toEqual({
      status: 200,
      body: { received: true },
    });
    expect(lue()).toMatchObject({
      payout: envoye,
      bankDispute: {
        id: DISPUTE,
        reason: "fraudulent",
        amount: 13199,
        at: T0,
      },
    });
  });

  it("un remboursement écrit au même moment n'est pas défait", async () => {
    poser({ status: "litige", dispute: { reason: "non_recue", at: T0 - DAY } });
    ecrivainConcurrent({
      status: "annulee",
      refundId: "re_1",
      refundedAt: T0,
    });

    await contestation("created");
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_1",
      bankDispute: { id: DISPUTE },
    });
  });

  it("rejeu du même événement : la date d'origine est gardée", async () => {
    poser();
    await contestation("created");
    vi.setSystemTime(T0 + DAY);
    orders.writes.length = 0;
    await contestation("created");
    expect(lue().bankDispute?.at).toBe(T0);
    expect(orders.writes).toEqual([]);
  });

  it("commande relue sans etag : 500, Stripe réessaiera ; rien n'est écrit", async () => {
    poser();
    orders.withoutEtag = true;
    const r = await contestation("created");
    expect(r.status).toBe(500);
    expect(lue()).not.toHaveProperty("bankDispute");
  });
});

describe("charge.dispute.closed — la suspension suit l'issue", () => {
  beforeEach(async () => {
    poser();
    await contestation("created");
    expect(await verserVendeur(ORDER_ID)).toBeNull();
    notifs.entries.clear();
    fetchMock.mockClear();
  });

  it.each([["won"], ["warning_closed"]])(
    "« %s » : contestation archivée, le virement part au prochain passage",
    async (statut) => {
      statutContestation = statut;
      vi.setSystemTime(T0 + 5 * DAY);
      expect((await contestation("closed")).status).toBe(200);

      const o = lue();
      expect(o).not.toHaveProperty("bankDispute");
      expect(o.bankDisputeClosed).toMatchObject({
        id: DISPUTE,
        at: T0,
        status: statut,
        closedAt: T0 + 5 * DAY,
      });
      expect(alertes().map((a) => a.text)).toEqual([
        `Contestation bancaire close en faveur du vendeur — commande ${ORDER_ID} : le virement au vendeur reprend automatiquement`,
      ]);

      expect(
        payoutAction(
          {
            status: "terminee",
            sellerId: o.sellerId,
            payoutMode: o.payoutMode,
            paidAt: o.paidAt,
            createdAt: o.createdAt,
            bankDispute: o.bankDispute ?? null,
          },
          T0 + 5 * DAY,
        ).kind,
      ).toBe("pay");
      const p = await verserVendeur(ORDER_ID);
      expect(p?.status).toBe("envoye");
    },
  );

  it.each([["lost"], ["prevented"]])(
    "« %s » : virement toujours suspendu, l'équipe décide (alerte et e-mail)",
    async (statut) => {
      statutContestation = statut;
      vi.setSystemTime(T0 + 5 * DAY);
      await contestation("closed");

      expect(lue().bankDispute).toMatchObject({
        id: DISPUTE,
        at: T0,
        status: statut,
        closedAt: T0 + 5 * DAY,
      });
      expect(await verserVendeur(ORDER_ID)).toBeNull();
      expect(fake.callsOf("payouts.create")).toEqual([]);
      expect(alertes()).toHaveLength(1);
      expect(alertes()[0].text).toContain(
        `Contestation bancaire perdue (${statut}) — commande ${ORDER_ID}`,
      );
      expect(emailsEnvoyes(fetchMock).map((m) => m.subject)).toContain(
        "SOLANGE — contestation bancaire perdue",
      );
    },
  );

  it("rejeu de la clôture : rien n'est réécrit, personne n'est re-prévenu", async () => {
    statutContestation = "lost";
    await contestation("closed");
    orders.writes.length = 0;
    await contestation("closed");
    expect(orders.writes).toEqual([]);
    expect(alertes()).toHaveLength(1);
  });

  it("clôture d'une AUTRE contestation que celle notée : ignorée", async () => {
    statutContestation = "won";
    orders.putJSON(`o:${ORDER_ID}`, {
      ...lue(),
      bankDispute: { id: "dp_autre", at: T0 },
    });
    await contestation("closed");
    expect(lue().bankDispute).toMatchObject({ id: "dp_autre" });
    expect(alertes()).toEqual([]);
  });
});

describe("paiement confirmé — rattachement du paiement", () => {
  it("le paymentIntentId est écrit sans effacer une écriture concurrente", async () => {
    poser({
      status: "en_attente",
      paidAt: undefined,
      paymentIntentId: undefined,
      commissionRate: 0.05,
      commissionEUR: 6,
      history: [],
    });
    session = {
      status: "complete",
      payment_status: "paid",
      amount_total: 13199,
      payment_intent: PI,
      metadata: { orderId: ORDER_ID },
    };
    ecrivainConcurrent({ checkoutSessionId: "cs_test_1" });

    const r = await evenement("checkout.session.completed", {
      id: "cs_test_1",
      payment_status: "paid",
    });
    expect(r.status).toBe(200);
    expect(lue()).toMatchObject({
      status: "payee",
      paymentIntentId: PI,
      checkoutSessionId: "cs_test_1",
      paidAt: T0,
    });
  });
});
