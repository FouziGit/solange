import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import deleteAccount from "../../account-delete.mts";
import { makeSessionCookie } from "../core.mts";
import { fakeStores, type FakeStore } from "./fake-blobs";

/* Suppression de compte et ventes en cours (D-037). Le vendeur n'est payé
   qu'à la livraison, et son compte porte le compte Stripe de destination :
   tant qu'une de ses ventes n'est pas terminée, ou qu'une vente terminée
   attend son virement, la suppression est refusée (409) et RIEN n'est
   effacé. Vraie session signée, stockage en mémoire. */

const h = vi.hoisted(() => ({
  stores: (name: string): FakeStore => {
    throw new Error(`store ${name} non préparé`);
  },
}));

vi.mock("@netlify/blobs", () => ({
  getStore: (o: string | { name: string }) =>
    h.stores(typeof o === "string" ? o : o.name),
}));

const VENDEUR = "u_bbbbbbbbbbbb";
const ACHETEUSE = "u_aaaaaaaaaaaa";
const EMAIL = "lou@exemple.fr";
const ANNONCE = "p_dispo0000001";
const VENTE = "o_vente0000001";
const ACHAT = "o_achat0000001";
const REFUS =
  "Tu as une vente en cours ou un virement en attente : attends la fin de la commande pour supprimer ton compte.";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let users: FakeStore;
let orders: FakeStore;
let products: FakeStore;
let cookie: string;

const envoye = {
  status: "envoye",
  amountCents: 11399,
  id: "po_deja",
  at: 1,
  attempts: 1,
  createTries: 0,
};

/** Une vente du membre (il est le VENDEUR), indexée dans sales:<id>. */
function vente(over: Record<string, unknown>, id = VENTE) {
  orders.putJSON(`o:${id}`, {
    id,
    buyerId: ACHETEUSE,
    sellerId: VENDEUR,
    productId: "p_vendue000001",
    brand: "Lemaire",
    name: "Veste croisée",
    status: "terminee",
    payoutMode: "manual",
    simulated: false,
    sellerCents: 11399,
    createdAt: 1,
    ...over,
  });
  const idx = (orders.peek(`sales:${VENDEUR}`) as string[] | null) ?? [];
  orders.putJSON(`sales:${VENDEUR}`, [...idx, id]);
}

async function supprimer() {
  const res = await deleteAccount(
    new Request("https://solange.test/api/account/delete", {
      method: "POST",
      headers: { cookie, origin: "https://solange.test" },
    }),
  );
  return { status: res.status, body: (await res.json()) as object };
}

/** Rien n'a bougé : compte, index e-mail, handle, annonce, index. */
function rienEfface() {
  expect(users.peek(`u:${VENDEUR}`)).toMatchObject({ id: VENDEUR });
  expect(users.text(`email:${sha256(EMAIL)}`)).toBe(VENDEUR);
  expect(users.text("handle:lou.mercier")).toBe(VENDEUR);
  expect(products.peek(`p:${ANNONCE}`)).toMatchObject({ status: "available" });
  expect(orders.peek(`sales:${VENDEUR}`)).not.toBeNull();
  for (const s of [users, orders, products]) {
    expect(s.writes).toEqual([]);
    expect(s.deletes).toEqual([]);
  }
}

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "secret-de-test-assez-long-pour-hs256");
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");

  const stores = fakeStores();
  h.stores = stores;
  users = stores("users");
  orders = stores("orders");
  products = stores("products");

  users.putJSON(`u:${VENDEUR}`, {
    id: VENDEUR,
    email: EMAIL,
    handle: "lou.mercier",
    name: "Lou",
    stripeAccountId: "acct_profil00001",
  });
  users.put(`email:${sha256(EMAIL)}`, VENDEUR);
  users.put("handle:lou.mercier", VENDEUR);
  products.putJSON(`p:${ANNONCE}`, {
    id: ANNONCE,
    sellerId: VENDEUR,
    status: "available",
    images: [],
  });
  products.putJSON("idx", [ANNONCE]);

  cookie = (await makeSessionCookie(VENDEUR)).split(";")[0];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Remet les journaux d'écriture à zéro une fois le décor posé. */
function decorPose() {
  for (const s of [users, orders, products]) {
    s.writes = [];
    s.deletes = [];
  }
}

describe("suppression refusée : vente en cours", () => {
  it.each([["payee"], ["expediee"], ["recue"], ["litige"], ["confirmee"]])(
    "vente « %s » : 409, rien n'est effacé",
    async (status) => {
      vente({ status, payout: undefined });
      decorPose();
      expect(await supprimer()).toEqual({
        status: 409,
        body: { error: REFUS },
      });
      rienEfface();
    },
  );

  it("vente en cours parmi des ventes terminées et versées : 409", async () => {
    vente({ payout: envoye }, "o_ancienne0001");
    vente({ status: "expediee" });
    decorPose();
    expect((await supprimer()).status).toBe(409);
    rienEfface();
  });
});

describe("suppression refusée : acheteur en train de payer", () => {
  /* L'index sales: n'est écrit qu'au paiement : pendant le Checkout
     Stripe, c'est la pièce réservée par une commande « en attente » qui
     signale la vente. */
  const RESERVEE = "p_reservee0001";
  function reservation(statutCommande: string) {
    products.putJSON(`p:${RESERVEE}`, {
      id: RESERVEE,
      sellerId: VENDEUR,
      status: "reserved",
      reservedBy: VENTE,
      reservedUntil: Date.now() + 20 * 60_000,
      images: [],
    });
    products.putJSON("idx", [ANNONCE, RESERVEE]);
    orders.putJSON(`o:${VENTE}`, {
      id: VENTE,
      buyerId: ACHETEUSE,
      sellerId: VENDEUR,
      productId: RESERVEE,
      status: statutCommande,
      payoutMode: "manual",
      createdAt: Date.now(),
    });
  }

  it("pièce réservée par une commande en attente de paiement : 409, rien n'est effacé", async () => {
    reservation("en_attente");
    decorPose();
    expect(await supprimer()).toEqual({ status: 409, body: { error: REFUS } });
    expect(users.peek(`u:${VENDEUR}`)).toMatchObject({ id: VENDEUR });
    expect(products.peek(`p:${RESERVEE}`)).toMatchObject({
      status: "reserved",
    });
    for (const st of [users, orders, products]) {
      expect(st.writes).toEqual([]);
      expect(st.deletes).toEqual([]);
    }
  });

  it("réservation d'une commande déjà expirée (annulée) : ne bloque pas", async () => {
    reservation("annulee");
    decorPose();
    expect((await supprimer()).status).toBe(200);
  });
});

describe("suppression refusée : virement en attente", () => {
  it.each([
    ["sans virement", undefined],
    [
      "en erreur",
      { status: "erreur", amountCents: 11399, attempts: 1, createTries: 0 },
    ],
    [
      "en attente de fonds",
      {
        status: "en_attente_fonds",
        amountCents: 11399,
        attempts: 1,
        createTries: 0,
      },
    ],
  ])("terminée, réelle, %s : 409", async (_cas, payout) => {
    vente({ payout });
    decorPose();
    expect(await supprimer()).toEqual({ status: 409, body: { error: REFUS } });
    rienEfface();
  });
});

describe("suppression permise", () => {
  it("ventes terminées et versées : compte supprimé", async () => {
    vente({ payout: envoye });
    vente(
      { payout: { ...envoye, status: "simule" }, simulated: true },
      "o_simulee00001",
    );
    decorPose();

    expect((await supprimer()).status).toBe(200);
    expect(users.peek(`u:${VENDEUR}`)).toBeNull();
    expect(users.text(`email:${sha256(EMAIL)}`)).toBeNull();
    expect(products.peek(`p:${ANNONCE}`)).toBeNull();
    expect(orders.peek(`sales:${VENDEUR}`)).toBeNull();
  });

  it("vente terminée d'avant les versements par commande : rien n'attend", async () => {
    vente({ payoutMode: undefined });
    decorPose();
    expect((await supprimer()).status).toBe(200);
    expect(users.peek(`u:${VENDEUR}`)).toBeNull();
  });

  it("vente terminée en démonstration sans virement : rien n'attend", async () => {
    vente({ simulated: true });
    decorPose();
    expect((await supprimer()).status).toBe(200);
  });

  it("vente annulée : rien n'attend", async () => {
    vente({ status: "annulee", refundId: "re_1" });
    decorPose();
    expect((await supprimer()).status).toBe(200);
  });

  it("aucune vente : suppression normale", async () => {
    expect((await supprimer()).status).toBe(200);
    expect(users.peek(`u:${VENDEUR}`)).toBeNull();
  });

  it("index des ventes corrompu ou commande disparue : ignorés", async () => {
    orders.putJSON(`sales:${VENDEUR}`, ["o_disparue0001", 42, null]);
    expect((await supprimer()).status).toBe(200);
  });

  /* Hors périmètre (D-037, signalé) : une commande où le membre est
     ACHETEUR ne bloque pas la suppression. Ce test documente la limite. */
  it("achat en cours (le membre est acheteur) : ne bloque pas", async () => {
    orders.putJSON(`o:${ACHAT}`, {
      id: ACHAT,
      buyerId: VENDEUR,
      sellerId: ACHETEUSE,
      status: "expediee",
      payoutMode: "manual",
      createdAt: 1,
    });
    orders.putJSON(`u:${VENDEUR}`, [ACHAT]);
    expect((await supprimer()).status).toBe(200);
  });
});
