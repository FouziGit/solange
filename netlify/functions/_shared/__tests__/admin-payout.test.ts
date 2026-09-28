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
import admin from "../../admin.mts";
import cron from "../../orders-cron.mts";
import { makeSessionCookie } from "../core.mts";
import type { OrderRecord } from "../order-core.mts";
import { CARRIERS } from "../../../../src/lib/shipping.ts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ACHETEUSE,
  ADMIN,
  COMPTE,
  DAY,
  HOUR,
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

/* /api/admin et les versements (D-037), joués de bout en bout : liste
   blanche des décisions de litige (une valeur inconnue ne tranche plus
   pour le vendeur), colis perdu (acheteur remboursé, pièce NON remise en
   vente), renvoi aux parties qui réarme le délai de clôture, relance
   manuelle du virement (et forçage malgré une contestation bancaire), et
   la file « Versements à surveiller ». Vraie session signée, vraies
   gardes, stockage en mémoire, Stripe simulé, remboursement mocké. */

type Remb = { ok: true; refundId: string } | { ok: false; error: string };

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
  stripe: null as FakeStripe | null,
  rembourser: (o: { id: string }): Promise<Remb> => {
    throw new Error(`rembourser(${o.id}) non préparé`);
  },
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

vi.mock("../stripe.mts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  stripe: () => h.stripe as unknown as Stripe | null,
  paymentsLive: () => h.stripe !== null,
  rembourser: (o: { id: string }) => h.rembourser(o),
}));

let orders: FakeStore;
let products: FakeStore;
let reports: FakeStore;
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;
let rembourser: Mock<(o: { id: string }) => Promise<Remb>>;
let cookieAdmin: string;

const poser = (over: Record<string, unknown> = {}, id = ORDER_ID) =>
  orders.putJSON(`o:${id}`, commandeReelle({ id, ...over }));
const lue = (id = ORDER_ID) => orders.peek(`o:${id}`) as OrderRecord;
const piece = () => products.peek(`p:${PRODUCT_ID}`) as { status: string };
const textes = (uid: string) => notifsDe(notifs, uid).map((n) => n.text);

type Audit = {
  action: string;
  targetType: string;
  targetId: string;
  note?: string;
  adminId: string;
};
/** Journal d'audit, dans l'ordre d'écriture. */
function audit(): Audit[] {
  const ids = (reports.peek("aidx") as string[] | null) ?? [];
  return ids.map((id) => reports.peek(`a:${id}`) as Audit);
}

async function appel(
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  cookie = cookieAdmin,
) {
  const res = await admin(
    new Request(
      `https://solange.test/api/admin${method === "GET" ? "?queue=open" : ""}`,
      {
        method,
        headers: {
          cookie,
          origin: "https://solange.test",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    ),
  );
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown> & {
      error?: string;
      payout?: Record<string, unknown> | null;
    },
  };
}

const litige = (over: Record<string, unknown> = {}) => ({
  status: "litige",
  shippedAt: T0 - 5 * DAY,
  shipment: { tracking: "31234567", at: T0 - 5 * DAY },
  dispute: { reason: "non_recue", note: "Rien reçu", at: T0 - 2 * DAY },
  ...over,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("SESSION_SECRET", "secret-de-test-assez-long-pour-hs256");
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("ADMIN_EMAILS", "admin@solange.test");
  fetchMock = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const stores = fakeStores();
  h.stores = stores;
  orders = stores("orders");
  products = stores("products");
  reports = stores("reports");
  notifs = stores("notifs");
  preparerComptes(stores("users"));
  products.putJSON(`p:${PRODUCT_ID}`, {
    id: PRODUCT_ID,
    brand: "Lemaire",
    name: "Veste croisée",
    sellerId: VENDEUR,
    status: "sold",
    soldOrderId: ORDER_ID,
  });

  fake = fakeStripe({
    accounts: [{ id: COMPTE }],
    balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
  });
  h.stripe = fake;
  rembourser = vi.fn(async () => ({ ok: true as const, refundId: "re_test" }));
  h.rembourser = rembourser;

  cookieAdmin = (await makeSessionCookie(ADMIN)).split(";")[0];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("op dispute — liste blanche des décisions", () => {
  it.each([["refund"], ["CANCEL"], ["__proto__"], ["toString"], [1], [true]])(
    "décision %j : 400, rien n'est tranché ni écrit",
    async (decision) => {
      poser(litige());
      const r = await appel("POST", {
        op: "dispute",
        orderId: ORDER_ID,
        decision,
      });
      expect(r).toEqual({ status: 400, body: { error: "Décision inconnue" } });
      expect(lue().status).toBe("litige");
      expect(orders.writes).toEqual([]);
      expect(rembourser).not.toHaveBeenCalled();
      expect(fake.callsOf("payouts.create")).toEqual([]);
      expect(audit()).toEqual([]);
    },
  );

  it("décision absente : 400 « Décision manquante »", async () => {
    poser(litige());
    const r = await appel("POST", { op: "dispute", orderId: ORDER_ID });
    expect(r).toEqual({ status: 400, body: { error: "Décision manquante" } });
    expect(orders.writes).toEqual([]);
  });

  it("close : terminée pour le vendeur, qui est payé", async () => {
    poser(litige());
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "close",
    });
    expect(r.status).toBe(200);
    expect(lue()).toMatchObject({
      status: "terminee",
      payout: { status: "envoye", amountCents: 11399 },
    });
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
    expect(audit().map((a) => a.action)).toEqual(["dispute_close"]);
  });

  it("cancel : annulée, remboursée, pièce remise en vente", async () => {
    poser(litige({ dispute: { reason: "non_conforme", at: T0 - DAY } }));
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "cancel",
    });
    expect(r.status).toBe(200);
    expect(lue()).toMatchObject({ status: "annulee", refundId: "re_test" });
    expect(lue().lostParcel).toBeUndefined();
    expect(piece().status).toBe("available");
    expect(audit().map((a) => a.action)).toEqual(["dispute_cancel"]);
  });
});

describe("op dispute « lost » — colis perdu", () => {
  it("litige « non reçu » : acheteur remboursé, pièce NON remise en vente, les deux prévenus", async () => {
    poser(litige());
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "lost",
    });

    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(rembourser).toHaveBeenCalledTimes(1);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      refundedAt: T0,
      lostParcel: { at: T0, by: "admin" },
      cancelReason: "Colis perdu",
    });
    expect(lue().history?.at(-1)).toMatchObject({
      by: "admin",
      from: "litige",
      to: "annulee",
      note: "Colis perdu",
    });
    expect(piece().status).toBe("sold");
    expect(fake.callsOf("payouts.create")).toEqual([]);

    expect(textes(ACHETEUSE)).toEqual([
      "Colis perdu : tu es intégralement remboursé",
    ]);
    expect(textes(VENDEUR)).toEqual([
      "Colis déclaré perdu — déclare la perte à Mondial Relay",
    ]);
    // le plafond du transporteur vient de CARRIERS, jamais d'un texte en dur
    const plafond = `${CARRIERS.mondial_relay.lossCompensationCents / 100} €`;
    expect(plafond).toBe("25 €");
    const mails = emailsEnvoyes(fetchMock).filter(
      (m) => m.subject === "Colis perdu — Lemaire Veste croisée",
    );
    expect(mails.map((m) => m.to).sort()).toEqual([
      "lou@exemple.fr",
      "maya@exemple.fr",
    ]);
    for (const m of mails) {
      expect(m.html).toContain(plafond);
      expect(m.html).toContain("31234567");
      expect(m.html).toContain(CARRIERS.mondial_relay.claimUrl);
    }

    expect(audit()).toEqual([
      expect.objectContaining({
        action: "dispute_lost",
        targetType: "order",
        targetId: ORDER_ID,
        adminId: ADMIN,
      }),
    ]);
  });

  it("note de l'admin : gardée comme motif", async () => {
    poser(litige());
    await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "lost",
      note: "Perte confirmée par Mondial Relay",
    });
    expect(lue().cancelReason).toBe("Perte confirmée par Mondial Relay");
    expect(audit()[0].note).toBe("Perte confirmée par Mondial Relay");
  });

  it("litige « non conforme » : 409, ni remboursement ni écriture", async () => {
    poser(litige({ dispute: { reason: "non_conforme", at: T0 - DAY } }));
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "lost",
    });
    expect(r).toEqual({
      status: 409,
      body: { error: "Colis perdu : seulement sur un litige « non reçu »" },
    });
    expect(lue().status).toBe("litige");
    expect(orders.writes).toEqual([]);
    expect(rembourser).not.toHaveBeenCalled();
    expect(piece().status).toBe("sold");
    expect(audit()).toEqual([]);
  });

  it("commande hors litige : 409", async () => {
    poser({ status: "expediee", shippedAt: T0 - DAY });
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "lost",
    });
    expect(r.status).toBe(409);
    expect(rembourser).not.toHaveBeenCalled();
    expect(lue().status).toBe("expediee");
  });
});

describe("op dispute « return » — renvoi aux parties", () => {
  const ancien = litige({
    shippedAt: T0 - 20 * DAY,
    remindReceiveAt: T0 - 13 * DAY,
    remindReceiveLastAt: T0 - 8 * DAY,
    disputeAlertAt: T0 - DAY,
  });

  it("expédiée de nouveau, délai de clôture et rappels remis à zéro", async () => {
    poser(ancien);
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "return",
    });

    expect(r).toEqual({ status: 200, body: { ok: true } });
    const o = lue();
    expect(o).toMatchObject({ status: "expediee", shippedAt: T0 });
    for (const champ of [
      "dispute",
      "remindReceiveAt",
      "remindReceiveLastAt",
      "disputeAlertAt",
    ])
      expect(o, champ).not.toHaveProperty(champ);
    // le suivi, lui, reste
    expect(o.shipment?.tracking).toBe("31234567");
    expect(o.history?.at(-1)).toEqual({
      at: T0,
      by: "admin",
      from: "litige",
      to: "expediee",
      note: "Renvoyé aux parties",
    });
    expect(audit().map((a) => a.action)).toEqual(["dispute_return"]);
  });

  it("cron juste après : pas de clôture ni de virement ; clôture et virement 14 jours plus tard", async () => {
    poser(ancien);
    await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "return",
    });

    // sans la remise à zéro, shippedAt à J-20 clôturait (et payait) ici
    await cron();
    expect(lue().status).toBe("expediee");
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(textes(ACHETEUSE)).toEqual([]);

    vi.setSystemTime(T0 + 14 * DAY);
    await cron();
    expect(lue()).toMatchObject({
      status: "terminee",
      payout: { status: "envoye" },
    });
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
  });

  it("commande qui n'est plus en litige : 409, rien n'est écrasé", async () => {
    const terminee = {
      status: "terminee",
      payout: {
        status: "envoye",
        amountCents: 11399,
        id: "po_deja",
        at: T0 - DAY,
        attempts: 1,
        createTries: 0,
      },
    };
    poser(terminee);
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "return",
    });
    expect(r).toEqual({
      status: 409,
      body: { error: "Impossible depuis « terminee »" },
    });
    expect(orders.writes).toEqual([]);
    expect(lue()).toEqual(commandeReelle(terminee));
    expect(audit()).toEqual([]);
  });

  it("lecture sans etag : 409, on n'écrit pas à l'aveugle", async () => {
    poser(ancien);
    orders.withoutEtag = true;
    const r = await appel("POST", {
      op: "dispute",
      orderId: ORDER_ID,
      decision: "return",
    });
    expect(r).toEqual({
      status: 409,
      body: { error: "Commande modifiée entre-temps — réessaie" },
    });
    expect(orders.writes).toEqual([]);
    expect(audit()).toEqual([]);
  });

  it("commande inconnue : 404", async () => {
    const r = await appel("POST", {
      op: "dispute",
      orderId: "o_inconnue0001",
      decision: "return",
    });
    expect(r).toEqual({ status: 404, body: { error: "Commande inconnue" } });
  });
});

describe("op payout — relance manuelle du virement", () => {
  const enErreur = {
    status: "erreur",
    amountCents: 11399,
    attempts: 1,
    createTries: 1,
    lastAttemptAt: T0 - HOUR,
    lastError: "Erreur interne simulée",
    alertedAt: T0 - HOUR,
  };

  it("virement en erreur : relancé tout de suite (sans attendre 24 h), clé suffixée", async () => {
    poser({ payout: enErreur });
    const r = await appel("POST", { op: "payout", orderId: ORDER_ID });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      payout: { status: "envoye", amountCents: 11399, attempts: 2 },
    });
    const [creation] = fake.callsOf("payouts.create");
    expect(creation.options).toEqual({
      stripeAccount: COMPTE,
      idempotencyKey: `payout-${ORDER_ID}-1`,
    });
    expect(lue().payout?.status).toBe("envoye");
    expect(audit()).toEqual([
      expect.objectContaining({
        action: "payout_retry",
        targetType: "order",
        targetId: ORDER_ID,
      }),
    ]);
    expect(audit()[0]).not.toHaveProperty("note");
  });

  it("contestation bancaire sans forçage : rien n'est versé", async () => {
    poser({ bankDispute: { id: "dp_1", reason: "fraudulent", at: T0 - DAY } });
    const r = await appel("POST", { op: "payout", orderId: ORDER_ID });
    expect(r).toEqual({ status: 200, body: { ok: true, payout: null } });
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(lue()).not.toHaveProperty("payout");
  });

  it("forçage à la chaîne « true » : refusé comme un non (booléen exigé)", async () => {
    poser({ bankDispute: { at: T0 - DAY } });
    const r = await appel("POST", {
      op: "payout",
      orderId: ORDER_ID,
      overrideBankDispute: "true",
    });
    expect(r.body.payout).toBeNull();
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("contestation bancaire, forçage explicite : versé, et tracé comme tel", async () => {
    poser({ bankDispute: { id: "dp_1", reason: "fraudulent", at: T0 - DAY } });
    const r = await appel("POST", {
      op: "payout",
      orderId: ORDER_ID,
      overrideBankDispute: true,
    });
    expect(r.status).toBe(200);
    expect(r.body.payout).toMatchObject({ status: "envoye" });
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
    expect(audit()).toEqual([
      expect.objectContaining({
        action: "payout_retry",
        note: "malgré contestation",
      }),
    ]);
  });

  it("expédiée à J+80, versement d'office en échec : relancé en versement d'office", async () => {
    poser({
      status: "expediee",
      paidAt: T0 - 81 * DAY,
      createdAt: T0 - 81 * DAY - HOUR,
      shippedAt: T0 - 75 * DAY,
      payout: enErreur,
    });
    const r = await appel("POST", { op: "payout", orderId: ORDER_ID });
    expect(r.status).toBe(200);
    expect(r.body.payout).toMatchObject({ status: "envoye", forced: true });
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
    expect(lue().status).toBe("expediee");
  });

  it("expédiée avant J+80, ou en litige même à J+85 : rien ne part", async () => {
    for (const over of [
      { status: "expediee", paidAt: T0 - 20 * DAY, payout: enErreur },
      litige({
        paidAt: T0 - 85 * DAY,
        createdAt: T0 - 85 * DAY - HOUR,
        payout: enErreur,
      }),
      { status: "payee", paidAt: T0 - 85 * DAY, payout: enErreur },
    ]) {
      poser(over);
      const r = await appel("POST", { op: "payout", orderId: ORDER_ID });
      expect(r).toEqual({ status: 200, body: { ok: true, payout: null } });
    }
    expect(fake.calls).toEqual([]);
  });

  it("déjà versé : rendu tel quel, aucun nouveau virement", async () => {
    const envoye = {
      status: "envoye",
      amountCents: 11399,
      id: "po_deja",
      at: T0 - DAY,
      attempts: 1,
      createTries: 0,
    };
    poser({ payout: envoye });
    const r = await appel("POST", { op: "payout", orderId: ORDER_ID });
    expect(r.body.payout).toEqual(envoye);
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("commande inconnue : 404 ; identifiant invalide : 400", async () => {
    expect(
      await appel("POST", { op: "payout", orderId: "o_inconnue0001" }),
    ).toEqual({ status: 404, body: { error: "Commande inconnue" } });
    expect(await appel("POST", { op: "payout", orderId: "o/../x" })).toEqual({
      status: 400,
      body: { error: "Commande manquante" },
    });
    expect(await appel("POST", { op: "payout" })).toEqual({
      status: 400,
      body: { error: "Commande manquante" },
    });
    expect(fake.calls).toEqual([]);
    expect(audit()).toEqual([]);
  });

  it("un membre (non admin) : 404, aucun virement", async () => {
    poser({ payout: enErreur });
    const cookieVendeur = (await makeSessionCookie(VENDEUR)).split(";")[0];
    const r = await appel(
      "POST",
      { op: "payout", orderId: ORDER_ID, overrideBankDispute: true },
      cookieVendeur,
    );
    expect(r).toEqual({ status: 404, body: { error: "Introuvable" } });
    expect(fake.calls).toEqual([]);
    expect(lue().payout).toEqual(enErreur);
  });
});

describe("GET — litiges enrichis et versements à surveiller", () => {
  const envoye = {
    status: "envoye",
    amountCents: 11399,
    id: "po_deja",
    at: T0 - DAY,
    attempts: 1,
    createTries: 0,
  };
  const erreur = {
    status: "erreur",
    amountCents: 11399,
    attempts: 2,
    createTries: 1,
    lastAttemptAt: T0 - HOUR,
    lastError: "Erreur interne simulée",
  };

  beforeEach(() => {
    poser(
      litige({ bankDispute: { id: "dp_9", at: T0 - DAY } }),
      "o_litige000001",
    );
    poser({ payout: erreur }, "o_erreur000001");
    poser(
      {
        payout: {
          status: "en_attente_fonds",
          amountCents: 11399,
          attempts: 1,
          createTries: 0,
          lastError: "Fonds pas encore disponibles chez Stripe",
        },
      },
      "o_fonds0000001",
    );
    poser(
      {
        status: "annulee",
        payout: envoye,
        refundAfterPayout: { at: T0 - HOUR },
      },
      "o_rembourse001",
    );
    poser({ bankDispute: { at: T0 - DAY } }, "o_conteste0001");
    // exclues : contestation déjà versée, versée, en cours sans virement
    poser({ bankDispute: { at: T0 - DAY }, payout: envoye }, "o_contverse01");
    poser({ payout: envoye }, "o_verse0000001");
    poser({ status: "expediee", shippedAt: T0 - DAY }, "o_expediee0001");
    // commande antérieure : rien à surveiller, même contestée (aucun
    // versement par commande, les boutons n'y feraient rien)
    poser(
      { payoutMode: undefined, sellerStripeAccountId: undefined },
      "o_ancienne0001",
    );
    poser(
      {
        payoutMode: undefined,
        sellerStripeAccountId: undefined,
        bankDispute: { at: T0 - DAY },
      },
      "o_anccontest01",
    );
  });

  it("litige : paiement, expédition, suivi, virement et contestation", async () => {
    const r = await appel("GET");
    expect(r.status).toBe(200);
    expect(r.body.disputes).toEqual([
      {
        id: "o_litige000001",
        brand: "Lemaire",
        name: "Veste croisée",
        buyerHandle: "maya.paris",
        sellerHandle: "lou.mercier",
        totalEUR: 131.99,
        dispute: { reason: "non_recue", note: "Rien reçu", at: T0 - 2 * DAY },
        createdAt: T0 - 10 * DAY - HOUR,
        paidAt: T0 - 10 * DAY,
        shippedAt: T0 - 5 * DAY,
        tracking: "31234567",
        shippingMethodId: "mondial_relay",
        shippingMethod: "Mondial Relay · Point Relais ou Locker",
        bankDispute: { id: "dp_9", at: T0 - DAY },
        payoutMode: "manual",
        simulated: false,
      },
    ]);
  });

  it("litige sur une commande Chronopost (historique) : le mode part tel quel, sans id de grille", async () => {
    poser(
      litige({
        shippingMethodId: undefined,
        shippingMethod: "Chronopost · Domicile",
      }),
      "o_chrono000001",
    );
    const r = await appel("GET");
    const d = (r.body.disputes as Array<Record<string, unknown>>).find(
      (x) => x.id === "o_chrono000001",
    );
    expect(d).toMatchObject({ shippingMethod: "Chronopost · Domicile" });
    expect(d).not.toHaveProperty("shippingMethodId");
  });

  it("litige sur une commande antérieure : pas de payoutMode, la note vendeur reste masquée", async () => {
    poser(
      litige({ payoutMode: undefined, sellerStripeAccountId: undefined }),
      "o_anclitige001",
    );
    const r = await appel("GET");
    const disputes = r.body.disputes as Array<Record<string, unknown>>;
    const ancien = disputes.find((d) => d.id === "o_anclitige001");
    expect(ancien).toBeDefined();
    expect(ancien).not.toHaveProperty("payoutMode");
    expect(ancien).toMatchObject({ simulated: false });
  });

  it("versements : erreur, fonds manquants, remboursé après versement, contestation sur terminée", async () => {
    const r = await appel("GET");
    const payouts = r.body.payouts as Array<{ id: string }>;
    expect(payouts.map((p) => p.id)).toEqual([
      "o_erreur000001",
      "o_fonds0000001",
      "o_rembourse001",
      "o_conteste0001",
    ]);
    expect(payouts[0]).toEqual({
      id: "o_erreur000001",
      brand: "Lemaire",
      name: "Veste croisée",
      sellerHandle: "lou.mercier",
      netSellerEUR: 113.99,
      status: "terminee",
      payout: erreur,
      paidAt: T0 - 10 * DAY,
      payoutMode: "manual",
      simulated: false,
      retryable: true,
    });
    expect(payouts[2]).toMatchObject({
      status: "annulee",
      payout: envoye,
      refundAfterPayout: { at: T0 - HOUR },
    });
    expect(payouts[3]).toMatchObject({
      status: "terminee",
      bankDispute: { at: T0 - DAY },
    });
    expect(payouts[3]).not.toHaveProperty("payout");
  });

  it("annulée sans versement parti : hors de la file ; relance proposée seulement si elle peut agir", async () => {
    // annulée (acheteur remboursé) avec un échec de versement : plus rien à verser
    poser({ status: "annulee", payout: erreur }, "o_annulerr001");
    // versement d'office tenté puis litige ouvert : on tranche d'abord
    poser(litige({ payout: erreur }), "o_litigerr001");
    // expédiée, versement d'office en échec : relançable à J+80, pas avant
    poser(
      {
        status: "expediee",
        paidAt: T0 - 81 * DAY,
        createdAt: T0 - 81 * DAY - HOUR,
        payout: erreur,
      },
      "o_expj8000001",
    );
    poser(
      { status: "expediee", paidAt: T0 - 20 * DAY, payout: erreur },
      "o_expj2000001",
    );

    const r = await appel("GET");
    const payouts = r.body.payouts as Array<{
      id: string;
      retryable?: boolean;
    }>;
    const ids = payouts.map((p) => p.id);
    expect(ids).not.toContain("o_annulerr001");
    const relance = Object.fromEntries(payouts.map((p) => [p.id, p.retryable]));
    expect(relance).toMatchObject({
      o_erreur000001: true,
      o_litigerr001: false,
      o_expj8000001: true,
      o_expj2000001: false,
      // remboursé après versement : rien à relancer
      o_rembourse001: false,
    });
  });

  it("lecture seule : la file n'écrit rien", async () => {
    orders.writes = [];
    await appel("GET");
    expect(orders.writes).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("un membre (non admin) : 404", async () => {
    const cookieVendeur = (await makeSessionCookie(VENDEUR)).split(";")[0];
    const r = await appel("GET", undefined, cookieVendeur);
    expect(r).toEqual({ status: 404, body: { error: "Introuvable" } });
  });
});
