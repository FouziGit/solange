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
import connect from "../../stripe-connect.mts";
import { makeSessionCookie } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ADMIN,
  COMPTE_PROFIL,
  DAY,
  ERREURS,
  HOUR,
  T0,
  VENDEUR,
  emailsEnvoyes,
  fakeStripe,
  notifsDe,
  preparerComptes,
  type FakeStripe,
} from "./fake-stripe";

/* /api/stripe/connect et les versements manuels (D-037) : un compte créé
   naît en versements manuels ; un compte existant (hebdomadaire) est
   basculé à son prochain passage, en GET comme en POST ; une bascule
   impossible ne bloque jamais le membre et n'alerte les admins qu'une
   fois par jour ; un solde déjà disponible à la bascule est signalé, pas
   versé. Vraie session signée, vraies gardes, Stripe simulé. */

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

let users: FakeStore;
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;
let cookie: string;

const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");

async function appel(method: "GET" | "POST") {
  const res = await connect(
    new Request("https://solange.test/api/stripe/connect", {
      method,
      headers: { cookie, origin: "https://solange.test" },
    }),
  );
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

function avecCompte(interval: string, balance = 0, pending = 0) {
  fake = fakeStripe({
    accounts: [{ id: COMPTE_PROFIL, interval }],
    balance: { amount: balance, sourceTypes: { card: balance }, pending },
  });
  h.stripe = fake;
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
  notifs = stores("notifs");
  preparerComptes(users);
  avecCompte("weekly");

  cookie = (await makeSessionCookie(VENDEUR)).split(";")[0];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("création du compte vendeur", () => {
  it("POST sans compte : versements manuels, clé d'idempotence v2", async () => {
    preparerComptes(users, { stripeAccountId: undefined });
    const r = await appel("POST");

    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^https:\/\/connect\.stripe\.test\//);
    const [creation] = fake.callsOf("accounts.create");
    // plus d'ancre « vendredi » : le calendrier est manuel, rien d'autre
    expect(
      (creation.params as { settings: { payouts: { schedule: object } } })
        .settings.payouts.schedule,
    ).toEqual({ interval: "manual" });
    expect(creation.options).toEqual({
      idempotencyKey: `connect-account-v2-${VENDEUR}`,
    });
    const rec = users.peek(`u:${VENDEUR}`) as { stripeAccountId: string };
    expect(rec.stripeAccountId).toMatch(/^acct_cree/);
    // né en manuel : aucune bascule à faire
    expect(fake.callsOf("accounts.update")).toEqual([]);
  });
});

describe("bascule des comptes existants", () => {
  it("GET compte hebdomadaire : basculé une fois, puis plus rien", async () => {
    const r1 = await appel("GET");
    expect(r1).toEqual({
      status: 200,
      body: { enabled: true, status: "actif", payable: true },
    });
    expect(fake.callsOf("accounts.update")).toHaveLength(1);
    expect(fake.callsOf("accounts.update")[0].params).toEqual({
      id: COMPTE_PROFIL,
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
    expect(fake.state.accounts.get(COMPTE_PROFIL)?.settings.payouts).toEqual({
      schedule: { interval: "manual" },
    });

    await appel("GET");
    expect(fake.callsOf("accounts.update")).toHaveLength(1);
    // solde nul à la bascule : aucune alerte
    expect(alertes()).toEqual([]);
  });

  it("GET compte déjà manuel : aucune mise à jour, aucune lecture de solde", async () => {
    avecCompte("manual");
    await appel("GET");
    expect(fake.callsOf("accounts.update")).toEqual([]);
    expect(fake.callsOf("balance.retrieve")).toEqual([]);
  });

  it("POST compte existant : relu chez Stripe puis basculé, lien d'inscription rendu", async () => {
    const r = await appel("POST");
    expect(r.status).toBe(200);
    expect(r.body.url).toBe(`https://connect.stripe.test/${COMPTE_PROFIL}`);
    expect(fake.callsOf("accounts.create")).toEqual([]);
    expect(fake.calls.map((c) => c.method)).toEqual([
      "accounts.retrieve",
      "accounts.update",
      "balance.retrieve",
      "accountLinks.create",
    ]);
  });

  it("bascule impossible : réponse normale, une seule alerte admin par jour", async () => {
    fake.state.errors["accounts.update"] = ERREURS.permission();

    const r1 = await appel("GET");
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe("actif");
    const r2 = await appel("POST");
    expect(r2.status).toBe(200);
    expect(r2.body.url).toBeDefined();
    vi.setSystemTime(T0 + HOUR);
    await appel("GET");

    expect(fake.callsOf("accounts.update")).toHaveLength(3);
    expect(alertes()).toHaveLength(1);
    expect(alertes()[0].text).toContain(
      "ajouter Connect › Accounts (écriture)",
    );
    expect(
      emailsEnvoyes(fetchMock).filter(
        (m) => m.subject === "SOLANGE — versements vendeur à configurer",
      ),
    ).toHaveLength(1);

    // le lendemain, une nouvelle alerte
    vi.setSystemTime(T0 + DAY + HOUR);
    await appel("GET");
    expect(alertes()).toHaveLength(2);
  });

  it("solde déjà disponible à la bascule : signalé aux admins, jamais versé", async () => {
    avecCompte("weekly", 4_250);
    await appel("GET");

    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(alertes().map((a) => a.text)).toEqual([
      `Compte ${COMPTE_PROFIL} basculé en versements manuels avec 42,50 € disponibles non rattachés à une commande : à verser à la main depuis le Dashboard Stripe`,
    ]);
    expect(fake.callsOf("balance.retrieve")[0].options).toEqual({
      stripeAccount: COMPTE_PROFIL,
    });
  });

  it("solde encore en attente chez Stripe à la bascule (vente récente) : signalé aussi", async () => {
    avecCompte("weekly", 0, 1_050);
    await appel("GET");
    expect(fake.callsOf("payouts.create")).toEqual([]);
    expect(alertes().map((a) => a.text)).toEqual([
      `Compte ${COMPTE_PROFIL} basculé en versements manuels avec 10,50 € en attente chez Stripe non rattachés à une commande : à verser à la main depuis le Dashboard Stripe (la part en attente, une fois devenue disponible)`,
    ]);
  });

  it("disponible et en attente : les deux montants dans une seule alerte", async () => {
    avecCompte("weekly", 4_250, 1_050);
    await appel("GET");
    expect(alertes().map((a) => a.text)).toEqual([
      `Compte ${COMPTE_PROFIL} basculé en versements manuels avec 42,50 € disponibles et 10,50 € en attente chez Stripe non rattachés à une commande : à verser à la main depuis le Dashboard Stripe (la part en attente, une fois devenue disponible)`,
    ]);
  });

  it("solde nul, rien en attente : aucune alerte", async () => {
    avecCompte("weekly");
    await appel("GET");
    expect(alertes()).toEqual([]);
  });
});
