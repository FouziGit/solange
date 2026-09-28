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
import createOrder from "../../orders.mts";
import { makeSessionCookie } from "../core.mts";
import { montants } from "../../../../src/lib/payments.ts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ACHETEUSE,
  ADMIN,
  COMPTE_PROFIL,
  ERREURS,
  HOUR,
  PRODUCT_ID,
  T0,
  VENDEUR,
  emailsEnvoyes,
  fakeStripe,
  notifsDe,
  preparerComptes,
  type FakeStripe,
} from "./fake-stripe";

/* POST /api/orders et le port à la taille du colis (D-037) : le port est
   lu dans la grille Mondial Relay selon le mode choisi et la taille FIGÉE
   sur l'annonce, jamais pris dans le corps de la requête ; un récapitulatif
   périmé est refusé avant toute réservation. En paiement réel, le compte
   du vendeur passe en versements manuels AVANT la réservation, et une
   bascule ou un accès impossible bloque l'achat (503) sans rien créer.
   Vraie session signée, vraies gardes, stockage en mémoire, Stripe simulé :
   aucun appel réseau. */

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

const RELAIS = "Tabac de la Gare — 12 rue du Commerce, 75011 Paris";
const PRIX_CENTS = 12_000;

let users: FakeStore;
let orders: FakeStore;
let products: FakeStore;
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;
let cookie: string;

type Commande = Record<string, unknown> & {
  id: string;
  shippingCents: number;
  totalCents: number;
};

/** Annonce du vendeur, disponible, taille de colis au choix (absente :
    annonce déposée avant D-037). */
function annonce(over: Record<string, unknown> = {}) {
  products.putJSON(`p:${PRODUCT_ID}`, {
    id: PRODUCT_ID,
    brand: "Lemaire",
    name: "Veste croisée",
    priceEUR: PRIX_CENTS / 100,
    size: "M",
    seller: "lou.mercier",
    sellerId: VENDEUR,
    status: "available",
    packageSize: "grand",
    ...over,
  });
}

const piece = () =>
  products.peek(`p:${PRODUCT_ID}`) as {
    status: string;
    reservedBy?: string;
  };

/** Commandes écrites dans le store (hors index u:/sales:). */
const commandesEcrites = () =>
  [...orders.entries.keys()].filter((k) => k.startsWith("o:"));

const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");

function stripeAvec(interval = "manual") {
  fake = fakeStripe({
    accounts: [{ id: COMPTE_PROFIL, interval }],
    balance: { amount: 0, sourceTypes: { card: 0 } },
  });
  h.stripe = fake;
}

async function commander(body: Record<string, unknown>) {
  const res = await createOrder(
    new Request("https://solange.test/api/orders", {
      method: "POST",
      headers: {
        cookie,
        origin: "https://solange.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        productId: PRODUCT_ID,
        acceptCgv: true,
        shippingMethod: "mondial_relay",
        relayLabel: RELAIS,
        ...body,
      }),
    }),
  );
  return {
    status: res.status,
    body: (await res.json()) as {
      error?: string;
      order?: Commande;
      checkoutUrl?: string;
    },
  };
}

type LigneStripe = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: { name: string };
  };
};

/** Paramètres de la session Checkout créée (paiement réel). */
function session() {
  const [appel] = fake.callsOf("checkout.sessions.create");
  return appel.params as {
    line_items: LigneStripe[];
    payment_intent_data: {
      transfer_data: { destination: string };
      application_fee_amount: number;
    };
  };
}

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
  users = stores("users");
  orders = stores("orders");
  products = stores("products");
  notifs = stores("notifs");
  preparerComptes(users);
  annonce();
  stripeAvec();

  cookie = (await makeSessionCookie(ACHETEUSE)).split(";")[0];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("port = grille Mondial Relay × taille figée sur l'annonce", () => {
  it("Grand en Point Relais : 7,99 €, sur la commande ET sur la ligne Stripe", async () => {
    const r = await commander({});

    expect(r.status).toBe(200);
    const m = montants(PRIX_CENTS, 799);
    expect(r.body.order).toMatchObject({
      packageSize: "grand",
      shippingMethodId: "mondial_relay",
      shippingCents: 799,
      shippingEUR: 7.99,
      shippingMethod: "Mondial Relay · Point Relais ou Locker",
      shippingLabel: `Mondial Relay · Point Relais ou Locker · ${RELAIS}`,
      totalCents: m.totalCents,
      sellerCents: m.sellerCents,
      applicationFeeCents: m.applicationFeeCents,
    });

    const livraison = session().line_items.filter((l) =>
      l.price_data.product_data.name.startsWith("Livraison"),
    );
    expect(livraison).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: 799,
          product_data: {
            name: "Livraison — Mondial Relay · Point Relais ou Locker · colis Grand",
          },
        },
      },
    ]);
    // ce que Stripe encaisse = la somme des lignes = le total de la commande
    const encaisse = session().line_items.reduce(
      (n, l) => n + l.quantity * l.price_data.unit_amount,
      0,
    );
    expect(encaisse).toBe(m.totalCents);
    expect(session().payment_intent_data).toMatchObject({
      transfer_data: { destination: COMPTE_PROFIL },
      application_fee_amount: m.applicationFeeCents,
    });
  });

  it("Grand à domicile : 10,99 €, adresse gardée, pas de point relais", async () => {
    const r = await commander({
      shippingMethod: "mondial_relay_domicile",
      relayLabel: RELAIS, // résidu d'un relais choisi avant : ignoré
      address: {
        name: "Maya Laurent",
        line: "4 rue des Martyrs",
        postal: "75009",
        city: "Paris",
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({
      shippingMethodId: "mondial_relay_domicile",
      shippingCents: 1099,
      shippingMethod: "Mondial Relay · À domicile",
      shippingLabel: "Mondial Relay · À domicile",
      address: {
        name: "Maya Laurent",
        line: "4 rue des Martyrs",
        postal: "75009",
        city: "Paris",
      },
    });
  });

  it("les montants envoyés par le client sont ignorés", async () => {
    const r = await commander({
      shippingCents: 1,
      shippingEUR: 0.01,
      shippingPrice: 0,
      priceEUR: 1,
      totalEUR: 1,
      totalCents: 100,
      packageSize: "petit",
    });
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({
      packageSize: "grand",
      shippingCents: 799,
      totalCents: montants(PRIX_CENTS, 799).totalCents,
    });
  });

  it("expectedShippingCents égal au port : accepté, et jamais utilisé comme montant", async () => {
    const r = await commander({ expectedShippingCents: 799 });
    expect(r.status).toBe(200);
    expect(r.body.order?.shippingCents).toBe(799);
  });

  it("expectedShippingCents différent : 409 avant toute réservation, rien de créé", async () => {
    const r = await commander({ expectedShippingCents: 599 });

    expect(r).toEqual({
      status: 409,
      body: {
        error:
          "Le prix du port a changé — recharge la page pour voir le nouveau montant",
      },
    });
    expect(piece().status).toBe("available");
    expect(products.writes).toEqual([]);
    expect(commandesEcrites()).toEqual([]);
    expect(orders.writes).toEqual([]);
    // aucun appel Stripe non plus : le contrôle passe avant le vendeur
    expect(fake.calls).toEqual([]);
  });

  it("annonce déposée avant la taille de colis : « Moyen », 5,99 € en relais", async () => {
    annonce({ packageSize: undefined });
    const r = await commander({});
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({
      packageSize: "moyen",
      shippingCents: 599,
    });
    expect(
      session().line_items.map((l) => l.price_data.product_data.name),
    ).toContain(
      "Livraison — Mondial Relay · Point Relais ou Locker · colis Moyen",
    );
  });

  it("taille corrompue sur l'annonce : repli « Moyen », jamais un port inventé", async () => {
    annonce({ packageSize: "__proto__" });
    const r = await commander({});
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({
      packageSize: "moyen",
      shippingCents: 599,
    });
  });
});

describe("mode de livraison et adresse", () => {
  it.each([
    ["chronopost"],
    ["point_relais"],
    ["__proto__"],
    ["constructor"],
    ["Mondial Relay"],
    [""],
  ])("mode « %s » : 400, rien de réservé", async (mode) => {
    const r = await commander({ shippingMethod: mode });
    expect(r).toEqual({
      status: 400,
      body: { error: "Choisis un mode de livraison" },
    });
    expect(piece().status).toBe("available");
    expect(commandesEcrites()).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("mode absent ou non textuel : 400", async () => {
    for (const shippingMethod of [undefined, 42, null, ["mondial_relay"]]) {
      const r = await commander({ shippingMethod });
      expect(r.status, String(shippingMethod)).toBe(400);
      expect(r.body.error).toBe("Choisis un mode de livraison");
    }
    expect(commandesEcrites()).toEqual([]);
  });

  it("domicile sans adresse complète : 400, rien de réservé", async () => {
    const r = await commander({
      shippingMethod: "mondial_relay_domicile",
      address: { name: "Maya", line: "4 rue des Martyrs", postal: "75009" },
    });
    expect(r).toEqual({
      status: 400,
      body: { error: "Complète l'adresse de livraison" },
    });
    expect(piece().status).toBe("available");
    expect(commandesEcrites()).toEqual([]);
  });

  it("Point Relais sans point relais : 400", async () => {
    const r = await commander({ relayLabel: "" });
    expect(r).toEqual({
      status: 400,
      body: { error: "Choisis un point relais" },
    });
    expect(commandesEcrites()).toEqual([]);
  });
});

describe("paiement réel : versements manuels avant la réservation", () => {
  it("compte hebdomadaire : basculé en manuel AVANT la réservation", async () => {
    stripeAvec("weekly");
    const ordre: string[] = [];
    products.beforeWrite = (key) => {
      if (key === `p:${PRODUCT_ID}`)
        ordre.push(
          `réservation après ${fake.callsOf("accounts.update").length} bascule(s)`,
        );
    };

    const r = await commander({});

    expect(r.status).toBe(200);
    expect(ordre).toEqual(["réservation après 1 bascule(s)"]);
    expect(fake.callsOf("accounts.update")[0].params).toEqual({
      id: COMPTE_PROFIL,
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
    expect(
      fake.state.accounts.get(COMPTE_PROFIL)?.settings.payouts.schedule,
    ).toEqual({ interval: "manual" });
    // accès vérifiés en lecture seule, avant la session de paiement
    const methodes = fake.calls.map((c) => c.method);
    expect(methodes.indexOf("payouts.list")).toBeLessThan(
      methodes.indexOf("checkout.sessions.create"),
    );
    expect(fake.callsOf("payouts.create")).toEqual([]);
  });

  it("compte déjà manuel : aucune mise à jour", async () => {
    const r = await commander({});
    expect(r.status).toBe(200);
    expect(fake.callsOf("accounts.update")).toEqual([]);
  });

  it("commande créée en versement par commande, compte de destination figé", async () => {
    const r = await commander({});

    expect(r.status).toBe(200);
    expect(r.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const id = r.body.order!.id;
    const stockee = orders.peek(`o:${id}`) as Record<string, unknown>;
    expect(stockee).toMatchObject({
      status: "en_attente",
      simulated: false,
      payoutMode: "manual",
      sellerStripeAccountId: COMPTE_PROFIL,
      packageSize: "grand",
      shippingMethodId: "mondial_relay",
      shippingCents: 799,
      checkoutSessionId: expect.stringMatching(/^cs_test_/),
    });
    expect(piece()).toMatchObject({ status: "reserved", reservedBy: id });
  });

  it("bascule impossible : 503, ni commande ni réservation, une alerte par jour", async () => {
    stripeAvec("weekly");
    fake.state.errors["accounts.update"] = ERREURS.permission();

    const r1 = await commander({});
    expect(r1).toEqual({
      status: 503,
      body: {
        error:
          "Paiement momentanément indisponible — réessaie un peu plus tard",
      },
    });
    expect(piece().status).toBe("available");
    expect(products.writes).toEqual([]);
    expect(commandesEcrites()).toEqual([]);
    expect(orders.writes).toEqual([]);
    expect(fake.callsOf("checkout.sessions.create")).toEqual([]);

    expect(alertes()).toHaveLength(1);
    expect(alertes()[0].text).toContain(COMPTE_PROFIL);
    expect(alertes()[0].text).toContain(
      "ajouter Connect › Accounts (écriture)",
    );
    expect(
      emailsEnvoyes(fetchMock).filter((m) => m.to === "admin@solange.test"),
    ).toHaveLength(1);

    // même panne une heure plus tard : toujours 503, pas de 2e alerte
    vi.setSystemTime(T0 + HOUR);
    const r2 = await commander({});
    expect(r2.status).toBe(503);
    expect(alertes()).toHaveLength(1);
    expect(commandesEcrites()).toEqual([]);
  });

  it("solde illisible (clé sans Balance) : 503, ni commande ni réservation", async () => {
    fake.state.errors["balance.retrieve"] = ERREURS.permission();

    const r = await commander({});

    expect(r.status).toBe(503);
    expect(piece().status).toBe("available");
    expect(commandesEcrites()).toEqual([]);
    expect(fake.callsOf("checkout.sessions.create")).toEqual([]);
    expect(alertes()).toHaveLength(1);
    expect(alertes()[0].text).toContain("ajouter Balance (lecture)");
  });

  it("virements illisibles (clé sans Payouts) : 503", async () => {
    fake.state.errors["payouts.list"] = ERREURS.permission();

    const r = await commander({});

    expect(r.status).toBe(503);
    expect(piece().status).toBe("available");
    expect(commandesEcrites()).toEqual([]);
    expect(alertes()[0].text).toContain("ajouter Connect › Payouts (lecture)");
  });

  it("vendeur sans compte Stripe : 409 inchangé, aucune bascule tentée", async () => {
    preparerComptes(users, { stripeAccountId: undefined });
    const r = await commander({});
    expect(r.status).toBe(409);
    expect(fake.callsOf("accounts.update")).toEqual([]);
    expect(commandesEcrites()).toEqual([]);
  });
});

describe("paiement simulé", () => {
  beforeEach(() => {
    h.stripe = null;
  });

  it("commande payée, versement par commande, sans compte de destination", async () => {
    const r = await commander({});

    expect(r.status).toBe(200);
    const id = r.body.order!.id;
    const stockee = orders.peek(`o:${id}`) as Record<string, unknown>;
    expect(stockee).toMatchObject({
      status: "payee",
      simulated: true,
      payoutMode: "manual",
      packageSize: "grand",
      shippingCents: 799,
    });
    expect(stockee).not.toHaveProperty("sellerStripeAccountId");
    expect(piece().status).toBe("sold");

    // le « Vendu » dit au vendeur quel format d'étiquette acheter
    const vendu = emailsEnvoyes(fetchMock).find(
      (m) => m.to === "lou@exemple.fr",
    );
    expect(vendu?.html).toContain("Grand");
    expect(vendu?.html).toContain("jusqu'à 2 kg");
    expect(vendu?.html).toContain("Mondial Relay · Point Relais ou Locker");
  });

  it("pièce du catalogue de démonstration : « Moyen », 5,99 €", async () => {
    products.entries.delete(`p:${PRODUCT_ID}`);
    const res = await createOrder(
      new Request("https://solange.test/api/orders", {
        method: "POST",
        headers: {
          cookie,
          origin: "https://solange.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          productId: "k3",
          acceptCgv: true,
          shippingMethod: "mondial_relay",
          relayLabel: RELAIS,
        }),
      }),
    );
    const body = (await res.json()) as { order: Commande };
    expect(res.status).toBe(200);
    expect(body.order).toMatchObject({
      packageSize: "moyen",
      shippingCents: 599,
      sellerId: null,
    });
  });
});
