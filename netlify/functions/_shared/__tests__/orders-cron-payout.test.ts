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
import cron from "../../orders-cron.mts";
import { applyTransition, type OrderRecord } from "../order-core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ACHETEUSE,
  ADMIN,
  COMPTE,
  DAY,
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

/* Le cron horaire et les versements (D-037) : nouvel essai quotidien
   quand les fonds manquent, vérification des virements envoyés, versement
   d'office à J+80 hors litige, alertes des litiges (7 jours, J+80, J+85
   URGENT), dernier rappel acheteur à J+12, et la course « réception +
   cron » qui ne crée qu'un seul virement. Horloge figée, Stripe simulé. */

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
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;

const poser = (over: Record<string, unknown> = {}) =>
  orders.putJSON(`o:${ORDER_ID}`, commandeReelle(over));
const lue = () => orders.peek(`o:${ORDER_ID}`) as OrderRecord;
const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");
const textes = (uid: string) => notifsDe(notifs, uid).map((n) => n.text);
const mailsAdmin = () =>
  emailsEnvoyes(fetchMock).filter((m) => m.to === "admin@solange.test");

async function passer(at: number) {
  vi.setSystemTime(at);
  const res = await cron();
  return (await res.json()) as { ok: boolean; acted: number };
}

function stripeAvec(o: Parameters<typeof fakeStripe>[0] = {}) {
  fake = fakeStripe({
    accounts: [{ id: COMPTE }],
    balance: { amount: 50_000, sourceTypes: { card: 50_000 } },
    ...o,
  });
  h.stripe = fake;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
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
  notifs = stores("notifs");
  preparerComptes(stores("users"));
  stripeAvec();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cron — virement des commandes terminées", () => {
  it("fonds absents : en attente ; +1 h rien ; +24 h avec fonds : envoyé", async () => {
    fake.setBalance(0, { card: 0 });
    poser();

    await passer(T0);
    expect(lue().payout).toMatchObject({
      status: "en_attente_fonds",
      attempts: 1,
    });
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(alertes()).toEqual([]);

    const avant = fake.calls.length;
    await passer(T0 + HOUR);
    expect(fake.calls.length).toBe(avant);

    fake.setBalance(20_000, { card: 20_000 });
    await passer(T0 + DAY);
    expect(lue().payout).toMatchObject({
      status: "envoye",
      attempts: 2,
      at: T0 + DAY,
    });
    expect(fake.callsOf("payouts.create")).toHaveLength(1);
    expect(textes(VENDEUR)).toEqual([
      "Virement envoyé : 113,99 € partent vers ta banque",
    ]);
  });

  it("réception + cron simultanés : un seul virement, statut final envoyé", async () => {
    poser({
      status: "expediee",
      shippedAt: T0 - 3 * DAY,
      shipment: { tracking: "31234567", at: T0 - 3 * DAY },
    });
    let enCours: Promise<Response> | undefined;
    // le cron démarre pendant l'écriture de « terminee » par la réception
    orders.beforeWrite = (key, body) => {
      if (
        !enCours &&
        key === `o:${ORDER_ID}` &&
        String(body).includes('"status":"terminee"')
      )
        enCours = cron();
    };

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "receive",
      role: "buyer",
      by: ACHETEUSE,
    });
    expect(enCours).toBeDefined();
    await enCours;

    expect(r.ok).toBe(true);
    expect(fake.state.created).toHaveLength(1);
    /* L'ordre exact des deux passages dépend de l'ordonnancement ; la
       création vraiment simultanée est couverte dans versement.test.ts. */
    for (const c of fake.callsOf("payouts.create"))
      expect(c.options?.idempotencyKey).toBe(`payout-${ORDER_ID}`);
    expect(lue().payout).toMatchObject({
      status: "envoye",
      id: fake.state.created[0].id,
    });
    expect(
      textes(VENDEUR).filter((t) => t.startsWith("Virement envoyé")),
    ).toHaveLength(1);
    expect(alertes()).toEqual([]);
  });

  it("commande antérieure sans payoutMode : le cron ne verse rien", async () => {
    poser({ payoutMode: undefined });
    await passer(T0);
    expect(fake.calls).toEqual([]);
    expect(lue().payout).toBeUndefined();
  });

  it("une commande illisible n'empêche pas de payer les suivantes", async () => {
    orders.put("o:000000casse", "{pas du json");
    poser();
    const r = await passer(T0);
    expect(r.ok).toBe(true);
    expect(lue().payout?.status).toBe("envoye");
  });
});

describe("cron — vérification des virements envoyés", () => {
  const envoye = (at: number) => ({
    status: "envoye",
    amountCents: 11399,
    id: "po_1",
    at,
    attempts: 1,
    createTries: 0,
    lastAttemptAt: at,
  });
  const virement = (status: "paid" | "failed") => ({
    id: "po_1",
    account: COMPTE,
    amount: 11399,
    status,
    failure_code: status === "failed" ? "account_closed" : null,
    metadata: { orderId: ORDER_ID },
    created: Math.floor((T0 - DAY - HOUR) / 1000),
  });

  it("payé : vérifié une fois par jour, pendant 15 jours seulement", async () => {
    stripeAvec({ payouts: [virement("paid")] });
    poser({ payout: envoye(T0 - DAY - HOUR) });

    await passer(T0);
    expect(lue().payout?.checkedAt).toBe(T0);
    await passer(T0 + HOUR);
    expect(fake.callsOf("payouts.retrieve")).toHaveLength(1);
    await passer(T0 + DAY);
    expect(fake.callsOf("payouts.retrieve")).toHaveLength(2);

    await passer(T0 + 15 * DAY);
    expect(fake.callsOf("payouts.retrieve")).toHaveLength(2);
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("échoué : erreur, vendeur et admins prévenus, puis nouveau virement le lendemain avec une nouvelle clé", async () => {
    stripeAvec({ payouts: [virement("failed")] });
    poser({ payout: envoye(T0 - DAY - HOUR) });

    await passer(T0);
    expect(lue().payout).toMatchObject({
      status: "erreur",
      lastError: "Virement failed (account_closed)",
      createTries: 1,
    });
    expect(textes(VENDEUR)).toEqual([
      "Ton virement a échoué : vérifie ton compte bancaire dans ton espace Stripe (Profil › Paiements)",
    ]);
    expect(alertes()).toHaveLength(1);

    await passer(T0 + HOUR);
    expect(fake.callsOf("payouts.create")).toEqual([]);

    await passer(T0 + DAY);
    const [creation] = fake.callsOf("payouts.create");
    expect(creation.options?.idempotencyKey).toBe(`payout-${ORDER_ID}-1`);
    expect(lue().payout).toMatchObject({
      status: "envoye",
      id: fake.state.created[0].id,
      createTries: 1,
    });
  });
});

describe("cron — versement d'office et litiges", () => {
  it("J+80 sans litige, commande encore expédiée : versement forcé", async () => {
    poser({
      status: "expediee",
      createdAt: T0 - 80 * DAY - HOUR,
      paidAt: T0 - 80 * DAY,
      shippedAt: T0 - 2 * DAY,
      shipment: { tracking: "31234567", at: T0 - 2 * DAY },
    });
    await passer(T0);
    expect(lue()).toMatchObject({
      status: "expediee",
      payout: { status: "envoye", forced: true },
    });
  });

  it("payée, jamais expédiée, annulation J+7 en échec : alerte quotidienne, et jamais de versement d'office, même à J+80", async () => {
    // remboursement impossible (ici : pas de clé Stripe côté remboursement)
    poser({
      status: "payee",
      createdAt: T0 - 7 * DAY - HOUR,
      paidAt: T0 - 7 * DAY,
    });
    await passer(T0);
    expect(lue().status).toBe("payee");
    const texte = `Annulation automatique impossible — commande ${ORDER_ID}, non expédiée depuis 7 jours : Remboursement impossible — Paiements réels non activés. L'acheteur n'est pas remboursé ; nouvel essai à chaque passage du cron.`;
    expect(alertes().map((a) => a.text)).toEqual([texte]);
    expect(
      mailsAdmin().filter(
        (m) => m.subject === "SOLANGE — annulation automatique en échec",
      ),
    ).toHaveLength(1);

    // nouvel essai chaque heure, alerte au plus une fois par jour
    await passer(T0 + HOUR);
    expect(alertes()).toHaveLength(1);
    await passer(T0 + DAY + HOUR);
    expect(alertes()).toHaveLength(2);

    // J+80 : toujours payée — le vendeur n'est pas payé pour une pièce jamais partie
    await passer(T0 + 73 * DAY + HOUR);
    expect(lue().status).toBe("payee");
    expect(lue().payout).toBeUndefined();
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("annulation J+7 refusée par un conflit (statut changé entre-temps) : aucune alerte", async () => {
    poser({
      status: "payee",
      createdAt: T0 - 7 * DAY - HOUR,
      paidAt: T0 - 7 * DAY,
      simulated: true,
      paymentIntentId: undefined,
    });
    // le vendeur expédie juste avant l'écriture de l'annulation
    let fait = false;
    orders.beforeWrite = (key) => {
      if (fait || key !== `o:${ORDER_ID}`) return;
      fait = true;
      orders.putJSON(key, {
        ...(orders.peek(key) as object),
        status: "expediee",
        shippedAt: T0,
      });
    };
    await passer(T0);
    expect(lue().status).toBe("expediee");
    expect(alertes()).toEqual([]);
  });

  it("à J+79 : pas encore de versement forcé", async () => {
    poser({
      status: "expediee",
      createdAt: T0 - 79 * DAY - HOUR,
      paidAt: T0 - 79 * DAY,
      shippedAt: T0 - 2 * DAY,
    });
    await passer(T0);
    expect(fake.calls).toEqual([]);
  });

  it("litige ouvert depuis 7 jours : une seule alerte, sans e-mail ni versement", async () => {
    poser({
      status: "litige",
      dispute: { reason: "non_recue", at: T0 - 7 * DAY - HOUR },
    });
    await passer(T0);
    expect(alertes().map((a) => a.text)).toEqual([
      `Litige ouvert depuis plus de 7 jours — commande ${ORDER_ID}`,
    ]);
    expect(lue().disputeAlertAt).toBe(T0);
    await passer(T0 + DAY);
    await passer(T0 + 2 * DAY);
    expect(alertes()).toHaveLength(1);
    expect(mailsAdmin()).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("litige à J+80 : alerte quotidienne, jamais de versement", async () => {
    poser({
      status: "litige",
      createdAt: T0 - 80 * DAY - HOUR,
      paidAt: T0 - 80 * DAY,
      dispute: { reason: "non_conforme", at: T0 - 20 * DAY },
      disputeAlertAt: T0 - 5 * DAY,
    });
    await passer(T0);
    expect(alertes().map((a) => a.text)).toEqual([
      `Litige ouvert à J+80 après paiement — commande ${ORDER_ID} : à trancher avant la limite Stripe de 90 jours`,
    ]);
    expect(mailsAdmin().map((m) => m.subject)).toEqual([
      "SOLANGE — litige à trancher",
    ]);
    await passer(T0 + HOUR);
    expect(alertes()).toHaveLength(1);
    await passer(T0 + DAY);
    expect(alertes()).toHaveLength(2);
    expect(fake.calls).toEqual([]);
  });

  it("litige à J+85 : objet URGENT", async () => {
    poser({
      status: "litige",
      createdAt: T0 - 85 * DAY - HOUR,
      paidAt: T0 - 85 * DAY,
      dispute: { reason: "non_recue", at: T0 - 30 * DAY },
      disputeAlertAt: T0 - 2 * DAY,
    });
    await passer(T0);
    expect(mailsAdmin().map((m) => m.subject)).toEqual([
      "URGENT — SOLANGE : litige à trancher avant la limite Stripe de 90 jours",
    ]);
    expect(alertes()[0].text).toBe(
      `Commande ${ORDER_ID} : J+85 après paiement, la limite Stripe de 90 jours approche. Trancher maintenant.`,
    );
  });

  it("contestation bancaire sur une commande terminée : aucun virement, alerte à J+80", async () => {
    poser({ bankDispute: { id: "dp_1", reason: "fraudulent", at: T0 - DAY } });
    await passer(T0);
    expect(fake.calls).toEqual([]);
    expect(alertes()).toEqual([]);

    poser({
      bankDispute: { id: "dp_1", reason: "fraudulent", at: T0 - DAY },
      createdAt: T0 - 80 * DAY - HOUR,
      paidAt: T0 - 80 * DAY,
    });
    await passer(T0 + HOUR);
    expect(fake.calls).toEqual([]);
    expect(alertes().map((a) => a.text)).toEqual([
      `Litige (contestation bancaire) ouvert à J+80 après paiement — commande ${ORDER_ID} : à trancher avant la limite Stripe de 90 jours`,
    ]);
  });
});

describe("cron — dernier rappel acheteur à J+12", () => {
  it("envoyé une seule fois, marqueur posé", async () => {
    poser({
      status: "expediee",
      shippedAt: T0 - 12 * DAY - HOUR,
      remindReceiveAt: T0 - 5 * DAY,
      shipment: { tracking: "31234567", at: T0 - 12 * DAY - HOUR },
    });
    await passer(T0);
    await passer(T0 + HOUR);

    expect(textes(ACHETEUSE)).toEqual([
      "Dernier rappel : sans signalement de ta part d'ici 2 jours, la commande sera clôturée et le vendeur payé",
    ]);
    expect(lue().remindReceiveLastAt).toBe(T0);
    expect(
      emailsEnvoyes(fetchMock)
        .filter((m) => m.to === "maya@exemple.fr")
        .map((m) => m.subject),
    ).toEqual(["Tu as bien reçu ta pièce ? — Lemaire Veste croisée"]);
    expect(lue().status).toBe("expediee");
  });

  it("à J+14 la clôture l'emporte, et le vendeur est payé", async () => {
    poser({
      status: "expediee",
      shippedAt: T0 - 14 * DAY,
      shipment: { tracking: "31234567", at: T0 - 14 * DAY },
    });
    await passer(T0);
    expect(textes(ACHETEUSE)).not.toContain(
      "Dernier rappel : sans signalement de ta part d'ici 2 jours, la commande sera clôturée et le vendeur payé",
    );
    expect(lue()).toMatchObject({
      status: "terminee",
      payout: { status: "envoye" },
    });
  });
});
