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
import {
  verifierAccesVersements,
  verifierVersement,
  verserVendeur,
} from "../payout.mts";
import type { OrderRecord } from "../order-core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ADMIN,
  COMPTE,
  COMPTE_PROFIL,
  DAY,
  ERREURS,
  HOUR,
  ORDER_ID,
  T0,
  VENDEUR,
  commandeReelle,
  emailsEnvoyes,
  fakeStripe,
  notifsDe,
  preparerComptes,
  type FakeStripe,
} from "./fake-stripe";

/* Versement au vendeur (D-037), appelé directement : périmètre, montant,
   compte de destination, réconciliation, choix de la source du solde,
   clés d'idempotence, erreurs classées et alertes. Stockage en mémoire,
   Stripe simulé : aucun appel réseau, aucune écriture Stripe réelle. */

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
  stripe: null as FakeStripe | null,
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

vi.mock("../stripe.mts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  stripe: () => h.stripe as unknown as Stripe | null,
  paymentsLive: () => h.stripe !== null,
}));

let orders: FakeStore;
let users: FakeStore;
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;

const poser = (over: Record<string, unknown> = {}) =>
  orders.putJSON(`o:${ORDER_ID}`, commandeReelle(over));
const lue = () => orders.peek(`o:${ORDER_ID}`) as OrderRecord;
const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("ADMIN_EMAILS", " Admin@Solange.test ");
  fetchMock = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const stores = fakeStores();
  h.stores = stores;
  orders = stores("orders");
  users = stores("users");
  notifs = stores("notifs");
  preparerComptes(users);

  fake = fakeStripe({
    accounts: [{ id: COMPTE }, { id: COMPTE_PROFIL }],
    balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
  });
  h.stripe = fake;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verserVendeur — virement d'une commande terminée", () => {
  it("vire sellerCents en EUR vers le compte figé sur la commande, clé payout-<id>", async () => {
    poser();
    const p = await verserVendeur(ORDER_ID);

    expect(fake.callsOf("payouts.create")).toHaveLength(1);
    const [appel] = fake.callsOf("payouts.create");
    expect(appel.params).toMatchObject({
      amount: 11399,
      currency: "eur",
      source_type: "card",
      metadata: { orderId: ORDER_ID },
      description: `SOLANGE ${ORDER_ID}`,
    });
    expect(appel.options).toEqual({
      stripeAccount: COMPTE,
      idempotencyKey: `payout-${ORDER_ID}`,
    });

    expect(p).toMatchObject({
      status: "envoye",
      amountCents: 11399,
      id: fake.state.created[0].id,
      at: T0,
      attempts: 1,
      createTries: 0,
      lastAttemptAt: T0,
      forced: false,
      sourceType: "card",
    });
    expect(lue().payout).toEqual(p);
    // seul le champ payout a changé
    const { payout, ...reste } = lue();
    void payout;
    expect(reste).toEqual(commandeReelle());

    expect(notifsDe(notifs, VENDEUR)).toEqual([
      expect.objectContaining({
        type: "order",
        text: "Virement envoyé : 113,99 € partent vers ta banque",
        link: `/commande/${ORDER_ID}`,
      }),
    ]);
    expect(alertes()).toEqual([]);
  });

  it("réconciliation bornée au paiement moins un jour", async () => {
    poser();
    await verserVendeur(ORDER_ID);
    const [liste] = fake.callsOf("payouts.list");
    expect(liste.params).toEqual({
      limit: 100,
      created: { gte: Math.floor((T0 - 10 * DAY - DAY) / 1000) },
    });
    expect(liste.options).toEqual({ stripeAccount: COMPTE });
  });

  it("déjà envoyé : rendu tel quel, sans appel Stripe", async () => {
    const envoye = {
      status: "envoye",
      amountCents: 11399,
      id: "po_deja",
      at: T0 - DAY,
      attempts: 1,
      createTries: 0,
    };
    poser({ payout: envoye });
    expect(await verserVendeur(ORDER_ID)).toEqual(envoye);
    expect(fake.calls).toEqual([]);
  });

  it("sans compte figé sur la commande : repli sur le compte du profil vendeur", async () => {
    poser({ sellerStripeAccountId: undefined });
    const p = await verserVendeur(ORDER_ID);
    expect(p?.status).toBe("envoye");
    expect(fake.callsOf("payouts.create")[0].options?.stripeAccount).toBe(
      COMPTE_PROFIL,
    );
  });

  it("aucun compte connu : erreur notée, alerte admin, aucun appel Stripe", async () => {
    users.putJSON(`u:${VENDEUR}`, { id: VENDEUR, email: "lou@exemple.fr" });
    poser({ sellerStripeAccountId: undefined });

    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "erreur",
      lastError: "Compte de paiement du vendeur introuvable",
      attempts: 1,
      createTries: 0,
      alertedAt: T0,
    });
    expect(lue().payout).toEqual(p);
    expect(fake.calls).toEqual([]);
    expect(alertes()).toEqual([
      expect.objectContaining({
        type: "report",
        text: `Versement vendeur en échec — commande ${ORDER_ID} : Compte de paiement du vendeur introuvable`,
      }),
    ]);
    expect(
      emailsEnvoyes(fetchMock).filter((m) => m.to === "admin@solange.test"),
    ).toEqual([
      expect.objectContaining({
        subject: "SOLANGE — versement vendeur en échec",
      }),
    ]);
  });

  it("montant vendeur introuvable : erreur et alerte, jamais un virement de 0", async () => {
    poser({ sellerCents: undefined, netSellerEUR: undefined });
    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "erreur",
      lastError: "Montant vendeur introuvable",
    });
    expect(fake.calls).toEqual([]);
    expect(alertes()).toHaveLength(1);
  });

  it("source_type : carte insuffisante, bank_account suffisant → vire depuis bank_account", async () => {
    fake.setBalance(12_000, { card: 500, bank_account: 11_500 });
    poser();
    const p = await verserVendeur(ORDER_ID);
    expect(fake.callsOf("payouts.create")[0].params).toMatchObject({
      amount: 11399,
      source_type: "bank_account",
    });
    expect(p).toMatchObject({ status: "envoye", sourceType: "bank_account" });
    expect(fake.state.balance.sourceTypes).toEqual({
      card: 500,
      bank_account: 101,
    });
  });

  it("solde agrégé sans détail par source : pas de source_type", async () => {
    fake.setBalance(20_000);
    poser();
    const p = await verserVendeur(ORDER_ID);
    expect(p?.status).toBe("envoye");
    expect(fake.callsOf("payouts.create")[0].params).not.toHaveProperty(
      "source_type",
    );
  });

  it("solde insuffisant : en attente de fonds, aucune création, pas d'alerte avant J+80", async () => {
    fake.setBalance(1_000, { card: 1_000 });
    poser();
    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "en_attente_fonds",
      lastError:
        "Fonds pas encore disponibles chez Stripe (disponible 10,00 €, requis 113,99 €)",
      attempts: 1,
      createTries: 0,
      lastAttemptAt: T0,
    });
    expect(p).not.toHaveProperty("alertedAt");
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(alertes()).toEqual([]);
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
  });

  it("solde insuffisant à J+80 : alerte, gardée 24 h", async () => {
    fake.setBalance(0, { card: 0 });
    poser({ paidAt: T0 - 80 * DAY, createdAt: T0 - 80 * DAY - HOUR });
    await verserVendeur(ORDER_ID);
    expect(alertes()).toHaveLength(1);

    vi.setSystemTime(T0 + HOUR);
    await verserVendeur(ORDER_ID);
    expect(alertes()).toHaveLength(1);
    expect(lue().payout).toMatchObject({ attempts: 2, alertedAt: T0 });

    vi.setSystemTime(T0 + DAY);
    await verserVendeur(ORDER_ID);
    expect(alertes()).toHaveLength(2);
  });

  it("commande simulée : « simule », sans appel Stripe ni notification", async () => {
    poser({ simulated: true, sellerStripeAccountId: undefined });
    const p = await verserVendeur(ORDER_ID);
    expect(p).toEqual({
      status: "simule",
      amountCents: 11399,
      at: T0,
      attempts: 1,
      createTries: 0,
    });
    expect(lue().payout).toEqual(p);
    expect(fake.calls).toEqual([]);
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
    expect(alertes()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("commande RÉELLE sans clé Stripe : erreur « Clé Stripe absente » et alerte, jamais « simule »", async () => {
    h.stripe = null;
    poser();
    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "erreur",
      lastError: "Clé Stripe absente : versement impossible",
    });
    expect(lue().payout?.status).toBe("erreur");
    expect(alertes()).toHaveLength(1);

    // nouvel essai une heure plus tard : toujours erreur, pas de seconde alerte
    vi.setSystemTime(T0 + HOUR);
    const p2 = await verserVendeur(ORDER_ID);
    expect(p2?.status).toBe("erreur");
    expect(p2?.attempts).toBe(2);
    expect(alertes()).toHaveLength(1);
  });

  it("réconciliation : un virement déjà payé pour la commande → envoyé, sans création", async () => {
    fake = fakeStripe({
      accounts: [{ id: COMPTE }],
      balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
      payouts: [
        {
          id: "po_autre",
          account: COMPTE,
          metadata: { orderId: "o_999999999999" },
          created: Math.floor((T0 - 2 * DAY) / 1000),
        },
        {
          id: "po_existant",
          account: COMPTE,
          amount: 11399,
          status: "paid",
          metadata: { orderId: ORDER_ID },
          created: Math.floor((T0 - DAY) / 1000),
        },
      ],
    });
    h.stripe = fake;
    poser();

    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "envoye",
      id: "po_existant",
      at: Math.floor((T0 - DAY) / 1000) * 1000,
    });
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(fake.callsOf("balance.retrieve")).toEqual([]);
    // passage à « envoyé » écrit ici : le vendeur est prévenu
    expect(notifsDe(notifs, VENDEUR)).toHaveLength(1);
  });

  it("réconciliation : un virement échoué est ignoré → nouvelle création, clé suffixée", async () => {
    fake = fakeStripe({
      accounts: [{ id: COMPTE }],
      balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
      payouts: [
        {
          id: "po_echoue",
          account: COMPTE,
          status: "failed",
          metadata: { orderId: ORDER_ID },
          created: Math.floor((T0 - 3 * DAY) / 1000),
        },
      ],
    });
    h.stripe = fake;
    poser({
      payout: {
        status: "erreur",
        amountCents: 11399,
        attempts: 1,
        createTries: 1,
        lastAttemptAt: T0 - 2 * DAY,
        lastError: "Virement failed (account_closed)",
      },
    });

    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({ status: "envoye", attempts: 2, createTries: 1 });
    expect(p?.id).not.toBe("po_echoue");
    expect(fake.callsOf("payouts.create")[0].options?.idempotencyKey).toBe(
      `payout-${ORDER_ID}-1`,
    );
  });

  it("création refusée : erreur, alerte ; le passage suivant change de clé", async () => {
    fake.failOnce("payouts.create", ERREURS.serveur());
    poser();

    const p1 = await verserVendeur(ORDER_ID);
    expect(p1).toMatchObject({
      status: "erreur",
      createTries: 1,
      lastError: "Erreur interne simulée",
    });
    expect(fake.callsOf("payouts.create")[0].options?.idempotencyKey).toBe(
      `payout-${ORDER_ID}`,
    );
    expect(alertes()).toHaveLength(1);

    vi.setSystemTime(T0 + DAY);
    const p2 = await verserVendeur(ORDER_ID);
    expect(p2).toMatchObject({ status: "envoye", attempts: 2, createTries: 1 });
    expect(fake.callsOf("payouts.create")[1].options?.idempotencyKey).toBe(
      `payout-${ORDER_ID}-1`,
    );
    expect(fake.state.created).toHaveLength(1);
  });

  it("idempotency_error (requête concurrente) : aucune écriture, aucune alerte", async () => {
    fake.failOnce("payouts.create", ERREURS.idempotence());
    poser();
    orders.writes.length = 0;

    expect(await verserVendeur(ORDER_ID)).toBeNull();
    expect(orders.writes).toEqual([]);
    expect(lue().payout).toBeUndefined();
    expect(alertes()).toEqual([]);
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
  });

  it("un virement envoyé entre-temps n'est jamais écrasé par un échec", async () => {
    fake.failOnce("payouts.create", ERREURS.serveur());
    poser();
    const envoye = {
      status: "envoye",
      amountCents: 11399,
      id: "po_concurrent",
      at: T0,
      attempts: 1,
      createTries: 0,
    };
    // un autre passage écrit « envoyé » juste avant notre écriture d'échec
    let fait = false;
    orders.beforeWrite = (key) => {
      if (fait || key !== `o:${ORDER_ID}`) return;
      fait = true;
      orders.putJSON(key, commandeReelle({ payout: envoye }));
    };

    expect(await verserVendeur(ORDER_ID)).toEqual(envoye);
    expect(lue().payout).toEqual(envoye);
    expect(alertes()).toEqual([]);
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
  });

  it("deux passages simultanés : un seul virement, une seule notification", async () => {
    poser();
    const [a, b] = await Promise.all([
      verserVendeur(ORDER_ID),
      verserVendeur(ORDER_ID),
    ]);

    // les deux passages ont demandé la création, avec la même clé
    const creations = fake.callsOf("payouts.create");
    expect(creations).toHaveLength(2);
    for (const c of creations)
      expect(c.options?.idempotencyKey).toBe(`payout-${ORDER_ID}`);
    expect(fake.state.created).toHaveLength(1);

    expect(lue().payout).toMatchObject({
      status: "envoye",
      id: fake.state.created[0].id,
      createTries: 0,
    });
    // le perdant (idempotency_error) n'écrit rien et ne s'inquiète pas
    expect([a?.status, b?.status]).toContain("envoye");
    expect(notifsDe(notifs, VENDEUR)).toHaveLength(1);
    expect(alertes()).toEqual([]);
  });

  it("deux passages simultanés, le second voit un solde entamé et choisit une autre source : clé réutilisée refusée, un seul virement", async () => {
    // carte : juste de quoi payer UNE fois ; virement bancaire : de quoi en payer une autre
    fake.setBalance(31_399, { card: 11_399, bank_account: 20_000 });
    poser();
    // le premier passage crée son virement pendant que le second lit le
    // solde : le second voit la carte vide et se rabat sur bank_account,
    // avec la MÊME clé d'idempotence
    const creer = fake.payouts.create.getMockImplementation()!;
    let fin = () => {};
    const premiereCreation = new Promise<void>((r) => (fin = r));
    fake.payouts.create.mockImplementationOnce(async (params, options) => {
      try {
        return await creer(params, options);
      } finally {
        fin();
      }
    });
    const lireSolde = fake.balance.retrieve.getMockImplementation()!;
    let lectures = 0;
    fake.balance.retrieve.mockImplementation(async (params, options) => {
      if (++lectures === 2) await premiereCreation;
      return lireSolde(params, options);
    });

    const [a, b] = await Promise.all([
      verserVendeur(ORDER_ID),
      verserVendeur(ORDER_ID),
    ]);

    const creations = fake.callsOf("payouts.create");
    expect(creations).toHaveLength(2);
    expect(creations.map((c) => c.options?.idempotencyKey)).toEqual([
      `payout-${ORDER_ID}`,
      `payout-${ORDER_ID}`,
    ]);
    expect(
      creations.map((c) => (c.params as { source_type?: string }).source_type),
    ).toEqual(["card", "bank_account"]);
    // Stripe refuse la clé réutilisée avec d'autres paramètres : un seul virement
    expect(fake.state.created).toHaveLength(1);
    expect(fake.state.created[0].source_type).toBe("card");
    expect(lue().payout).toMatchObject({
      status: "envoye",
      id: fake.state.created[0].id,
      sourceType: "card",
      createTries: 0,
    });
    expect([a?.status, b?.status]).toContain("envoye");
    expect(notifsDe(notifs, VENDEUR)).toHaveLength(1);
    expect(alertes()).toEqual([]);
  });

  it("versements désactivés sur le compte : le vendeur est invité à finir son inscription", async () => {
    fake.failOnce("payouts.create", ERREURS.versementsBloques());
    poser();
    const p = await verserVendeur(ORDER_ID);
    expect(p).toMatchObject({
      status: "erreur",
      lastError:
        "Versements désactivés sur le compte Stripe du vendeur (inscription à compléter)",
    });
    expect(notifsDe(notifs, VENDEUR)).toEqual([
      {
        type: "order",
        text: "Ton virement attend : termine ton inscription Stripe dans ton profil",
        link: "/profil",
        id: expect.any(String),
        at: T0,
        read: false,
      },
    ]);
    expect(alertes()).toHaveLength(1);
  });

  it("contestation bancaire sur une commande terminée : aucun virement, sauf décision admin", async () => {
    poser({ bankDispute: { id: "dp_1", at: T0 - DAY } });
    expect(await verserVendeur(ORDER_ID)).toBeNull();
    expect(fake.calls).toEqual([]);

    const p = await verserVendeur(ORDER_ID, { admin: true });
    expect(p?.status).toBe("envoye");
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
  });

  it("commande antérieure (sans payoutMode) : aucun versement par commande", async () => {
    poser({ payoutMode: undefined });
    expect(await verserVendeur(ORDER_ID)).toBeNull();
    expect(fake.calls).toEqual([]);
    expect(lue().payout).toBeUndefined();
  });

  it("hors périmètre : annulée, en attente, ou pas encore terminée sans forçage", async () => {
    for (const status of ["annulee", "en_attente", "expediee", "litige"]) {
      poser({ status });
      expect(await verserVendeur(ORDER_ID)).toBeNull();
    }
    expect(fake.calls).toEqual([]);

    poser({ status: "expediee" });
    const p = await verserVendeur(ORDER_ID, { force: true });
    expect(p).toMatchObject({ status: "envoye", forced: true });
  });

  it("versement d'office refusé en litige, sur une commande payée jamais expédiée, annulée ou en attente", async () => {
    for (const status of ["litige", "payee", "annulee", "en_attente"]) {
      poser({ status });
      expect(await verserVendeur(ORDER_ID, { force: true })).toBeNull();
      // même la décision admin sur contestation n'ouvre pas le litige
      expect(
        await verserVendeur(ORDER_ID, { force: true, admin: true }),
      ).toBeNull();
    }
    expect(fake.calls).toEqual([]);
    expect(lue().payout).toBeUndefined();
  });

  it("litige ouvert pendant les appels Stripe d'un versement d'office : le virement ne part pas", async () => {
    poser({ status: "expediee", paidAt: T0 - 80 * DAY });
    // l'acheteur ouvre un litige juste après la lecture du solde
    const lireSolde = fake.balance.retrieve.getMockImplementation()!;
    fake.balance.retrieve.mockImplementationOnce(async (params, options) => {
      const bal = await lireSolde(params, options);
      poser({
        status: "litige",
        paidAt: T0 - 80 * DAY,
        dispute: { reason: "non_recue", at: T0 },
      });
      return bal;
    });
    orders.writes.length = 0;

    expect(await verserVendeur(ORDER_ID, { force: true })).toBeNull();
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(orders.writes).toEqual([]);
    expect(lue()).toMatchObject({ status: "litige" });
    expect(lue().payout).toBeUndefined();
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
  });

  it("contestation bancaire arrivée pendant les appels Stripe : le virement ne part pas", async () => {
    poser();
    const lireSolde = fake.balance.retrieve.getMockImplementation()!;
    fake.balance.retrieve.mockImplementationOnce(async (params, options) => {
      const bal = await lireSolde(params, options);
      poser({ bankDispute: { id: "dp_1", at: T0 } });
      return bal;
    });
    expect(await verserVendeur(ORDER_ID)).toBeNull();
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("virement parti, mais la commande est passée en litige juste avant l'écriture : noté, et l'équipe prévenue", async () => {
    poser({ status: "expediee", paidAt: T0 - 80 * DAY });
    const creer = fake.payouts.create.getMockImplementation()!;
    fake.payouts.create.mockImplementationOnce(async (params, options) => {
      const p = await creer(params, options);
      poser({
        status: "litige",
        paidAt: T0 - 80 * DAY,
        dispute: { reason: "non_recue", at: T0 },
      });
      return p;
    });

    const p = await verserVendeur(ORDER_ID, { force: true });
    expect(p).toMatchObject({ status: "envoye", forced: true });
    // l'argent est parti : l'état le dit, sur la version fraîche
    expect(lue()).toMatchObject({
      status: "litige",
      payout: { status: "envoye" },
    });
    expect(lue().refundAfterPayout).toBeUndefined();
    expect(alertes().map((a) => a.text)).toEqual([
      `Virement vendeur parti alors que la commande ${ORDER_ID} est passée en « litige » : trancher le litige en tenant compte de la part déjà virée`,
    ]);
  });

  it("virement parti, mais la commande a été annulée et remboursée entre-temps : remboursement après versement noté", async () => {
    poser();
    const creer = fake.payouts.create.getMockImplementation()!;
    fake.payouts.create.mockImplementationOnce(async (params, options) => {
      const p = await creer(params, options);
      poser({ status: "annulee", refundId: "re_1", refundedAt: T0 });
      return p;
    });

    const p = await verserVendeur(ORDER_ID);
    expect(p?.status).toBe("envoye");
    expect(lue()).toMatchObject({
      status: "annulee",
      payout: { status: "envoye" },
      refundAfterPayout: { at: T0 },
    });
    expect(alertes()).toHaveLength(1);
    expect(alertes()[0].text).toContain("solde vendeur négatif");
  });

  it("échec de versement sur une commande annulée entre-temps : rien n'est écrit, personne n'est alerté", async () => {
    fake.failOnce("payouts.create", ERREURS.serveur());
    poser();
    const creer = fake.payouts.create.getMockImplementation()!;
    fake.payouts.create.mockImplementationOnce(async (params, options) => {
      poser({ status: "annulee", refundId: "re_1", refundedAt: T0 });
      return creer(params, options);
    });
    orders.writes.length = 0;

    expect(await verserVendeur(ORDER_ID)).toBeNull();
    expect(orders.writes).toEqual([]);
    expect(lue().payout).toBeUndefined();
    expect(alertes()).toEqual([]);
  });
});

describe("verifierVersement — un virement envoyé peut échouer plus tard", () => {
  const envoye = {
    status: "envoye",
    amountCents: 11399,
    at: T0 - DAY,
    attempts: 1,
    createTries: 0,
    lastAttemptAt: T0 - DAY,
  };

  function avecVirement(status: "paid" | "failed") {
    fake = fakeStripe({
      accounts: [{ id: COMPTE }],
      payouts: [
        {
          id: "po_1",
          account: COMPTE,
          status,
          failure_code: status === "failed" ? "account_closed" : null,
          metadata: { orderId: ORDER_ID },
        },
      ],
    });
    h.stripe = fake;
    poser({ payout: { ...envoye, id: "po_1" } });
  }

  it("payé : seule la date de vérification change", async () => {
    avecVirement("paid");
    const p = await verifierVersement(ORDER_ID, T0);
    expect(p).toEqual({ ...envoye, id: "po_1", checkedAt: T0 });
    expect(lue().payout).toEqual(p);
    expect(fake.callsOf("payouts.retrieve")[0].options).toEqual({
      stripeAccount: COMPTE,
    });
    expect(alertes()).toEqual([]);
  });

  it("échoué : erreur, nouvelle clé au prochain essai, vendeur et admins prévenus", async () => {
    avecVirement("failed");
    const p = await verifierVersement(ORDER_ID, T0);
    expect(p).toMatchObject({
      status: "erreur",
      lastError: "Virement failed (account_closed)",
      createTries: 1,
      checkedAt: T0,
      lastAttemptAt: T0,
    });
    expect(p).not.toHaveProperty("id");
    expect(lue().payout).toEqual(p);
    expect(notifsDe(notifs, VENDEUR).map((n) => n.text)).toEqual([
      "Ton virement a échoué : vérifie ton compte bancaire dans ton espace Stripe (Profil › Paiements)",
    ]);
    expect(alertes()).toHaveLength(1);
  });
});

describe("verifierAccesVersements — lecture seule, permission nommée", () => {
  it("clé sans lecture du solde : « Balance (lecture) »", async () => {
    fake.failOnce("balance.retrieve", ERREURS.permission());
    const r = await verifierAccesVersements(COMPTE);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("ajouter Balance (lecture)");
    expect(fake.callsOf("payouts.list")).toEqual([]);
  });

  it("clé sans lecture des virements : « Connect › Payouts (lecture) »", async () => {
    fake.failOnce("payouts.list", ERREURS.permission());
    const r = await verifierAccesVersements(COMPTE);
    expect(!r.ok && r.error).toContain("ajouter Connect › Payouts (lecture)");
    expect(fake.callsOf("payouts.list")[0].params).toEqual({ limit: 1 });
  });

  it("tout est lisible : ok, et rien n'est écrit chez Stripe", async () => {
    expect(await verifierAccesVersements(COMPTE)).toEqual({ ok: true });
    expect(fake.calls.map((c) => c.method)).toEqual([
      "balance.retrieve",
      "payouts.list",
    ]);
  });
});
