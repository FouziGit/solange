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
import { applyTransition, type OrderRecord } from "../order-core.mts";
import { CARRIERS } from "../../../../src/lib/shipping.ts";
import { BUYER_PROTECTION_TEXT } from "../../../../src/lib/payout.ts";
import { fakeStores, type FakeStore } from "./fake-blobs";
import {
  ACHETEUSE,
  ADMIN,
  COMPTE,
  DAY,
  ERREURS,
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

/* Transitions de commande et versement (D-037), jouées de bout en bout :
   écriture conditionnelle (etag), remboursement AVANT l'état, conflit
   après remboursement, colis perdu, numéro de suivi obligatoire, et
   virement au vendeur au passage à « terminee » sans jamais bloquer la
   transition. Stockage en mémoire, Stripe simulé, remboursement mocké. */

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
let notifs: FakeStore;
let fetchMock: Mock<typeof fetch>;
let fake: FakeStripe;
let rembourser: Mock<(o: { id: string }) => Promise<Remb>>;

const CONFLIT = "Commande modifiée entre-temps — réessaie";
const poser = (over: Record<string, unknown> = {}) =>
  orders.putJSON(`o:${ORDER_ID}`, commandeReelle(over));
const lue = () => orders.peek(`o:${ORDER_ID}`) as OrderRecord;
const piece = () => products.peek(`p:${PRODUCT_ID}`) as { status: string };
const alertes = () =>
  notifsDe(notifs, ADMIN).filter((n) => n.link === "/admin");
const textes = (uid: string) => notifsDe(notifs, uid).map((n) => n.text);

/** Un autre écrivain passe juste avant la PREMIÈRE écriture de la commande. */
function ecrivainConcurrent(modif: Record<string, unknown>) {
  let fait = false;
  orders.beforeWrite = (key) => {
    if (fait || key !== `o:${ORDER_ID}`) return;
    fait = true;
    orders.putJSON(key, { ...(orders.peek(key) as object), ...modif });
  };
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
  products = stores("products");
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("réception → le vendeur est payé", () => {
  const expediee = {
    status: "expediee",
    shippedAt: T0 - 3 * DAY,
    shipment: { tracking: "31234567", at: T0 - 3 * DAY },
  };

  it("receive : terminée, virement de sellerCents vers le compte de la commande", async () => {
    poser(expediee);
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "receive",
      role: "buyer",
      by: ACHETEUSE,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.status).toBe("terminee");
    expect(r.order.payout).toMatchObject({
      status: "envoye",
      amountCents: 11399,
    });

    const creations = fake.callsOf("payouts.create");
    expect(creations).toHaveLength(1);
    expect(creations[0].params).toMatchObject({
      amount: 11399,
      currency: "eur",
      metadata: { orderId: ORDER_ID },
    });
    expect(creations[0].options).toEqual({
      stripeAccount: COMPTE,
      idempotencyKey: `payout-${ORDER_ID}`,
    });

    expect(lue()).toMatchObject({
      status: "terminee",
      payout: { status: "envoye", id: fake.state.created[0].id },
    });
    expect(textes(VENDEUR)).toEqual(
      expect.arrayContaining([
        "L'acheteur a bien reçu la pièce",
        "Vente terminée",
        "Virement envoyé : 113,99 € partent vers ta banque",
      ]),
    );
  });

  it("clôture et litige tranché pour le vendeur paient aussi", async () => {
    poser(expediee);
    await applyTransition({
      orderId: ORDER_ID,
      action: "close",
      role: "system",
      by: "system",
    });
    expect(lue().payout?.status).toBe("envoye");

    fake.state.idem.clear();
    poser({
      status: "litige",
      dispute: { reason: "non_conforme", at: T0 - DAY },
    });
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_close",
      role: "admin",
      by: "admin",
    });
    expect(r.ok && r.order.payout?.status).toBe("envoye");
  });

  it("403 à la création du virement : erreur notée, admins alertés, transition réussie", async () => {
    fake.failOnce("payouts.create", ERREURS.permission());
    poser(expediee);
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "receive",
      role: "buyer",
      by: ACHETEUSE,
    });

    expect(r.ok).toBe(true);
    expect(lue().status).toBe("terminee");
    expect(lue().payout).toMatchObject({ status: "erreur", createTries: 1 });
    expect(lue().payout?.lastError).toContain(
      "ajouter Connect › Payouts (écriture)",
    );
    expect(alertes()).toEqual([
      expect.objectContaining({
        type: "report",
        link: "/admin",
        text: expect.stringContaining(
          `Versement vendeur en échec — commande ${ORDER_ID}`,
        ),
      }),
    ]);
    expect(
      emailsEnvoyes(fetchMock).some(
        (m) =>
          m.to === "admin@solange.test" &&
          m.subject === "SOLANGE — versement vendeur en échec",
      ),
    ).toBe(true);
  });

  it("commande simulée : « simule », aucun appel Stripe", async () => {
    poser({ ...expediee, simulated: true });
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "receive",
      role: "buyer",
      by: ACHETEUSE,
    });
    expect(r.ok && r.order.payout?.status).toBe("simule");
    expect(fake.calls).toEqual([]);
  });
});

describe("annulation et remboursement", () => {
  it("annulation avant versement : remboursement, pièce remise en vente, aucun virement", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "buyer",
      by: ACHETEUSE,
      note: "Je me suis trompée de taille",
    });

    expect(r.ok).toBe(true);
    expect(rembourser).toHaveBeenCalledTimes(1);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      refundedAt: T0,
    });
    expect(lue().payout).toBeUndefined();
    expect(lue().refundAfterPayout).toBeUndefined();
    expect(fake.calls).toEqual([]);
    expect(piece().status).toBe("available");
    expect(alertes()).toEqual([]);
  });

  it("remboursement échoué : la commande ne bouge pas, rien n'est écrit", async () => {
    rembourser.mockResolvedValueOnce({ ok: false, error: "Refus Stripe" });
    poser({ status: "payee", paidAt: T0 - DAY });
    orders.writes.length = 0;
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "seller",
      by: VENDEUR,
      note: "Pièce abîmée",
    });
    expect(r).toEqual({
      ok: false,
      error: "Remboursement impossible — Refus Stripe",
      code: 502,
    });
    expect(orders.writes).toEqual([]);
    expect(piece().status).toBe("sold");
  });

  it("remboursement APRÈS versement : noté (refundAfterPayout) et signalé aux admins", async () => {
    poser({
      status: "litige",
      dispute: { reason: "non_conforme", at: T0 - DAY },
      payout: {
        status: "envoye",
        amountCents: 11399,
        id: "po_force",
        at: T0 - 2 * DAY,
        attempts: 1,
        createTries: 0,
        forced: true,
      },
    });
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_cancel",
      role: "admin",
      by: "admin",
      note: "Pièce non conforme",
    });

    expect(r.ok).toBe(true);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      refundAfterPayout: { at: T0 },
    });
    expect(alertes().map((a) => a.text)).toEqual([
      `Remboursement après versement — commande ${ORDER_ID} : la part vendeur a été reprise sur un solde déjà versé (solde négatif, SOLANGE en répond)`,
    ]);
    expect(
      emailsEnvoyes(fetchMock).some(
        (m) => m.subject === "SOLANGE — remboursement après versement",
      ),
    ).toBe(true);
  });
});

describe("écriture conditionnelle (etag)", () => {
  it("conflit sans remboursement : 409, ni événement, ni écriture de la transition", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    ecrivainConcurrent({ remindShipAt: T0 - 1 });

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "ship",
      role: "seller",
      by: VENDEUR,
      tracking: "31234567",
    });

    expect(r).toEqual({ ok: false, error: CONFLIT, code: 409 });
    // la version du concurrent est intacte, la transition n'a rien écrit
    expect(lue()).toMatchObject({ status: "payee", remindShipAt: T0 - 1 });
    expect(lue().shipment).toBeUndefined();
    expect(orders.writes).toEqual([]);
    expect(notifsDe(notifs, ACHETEUSE)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lecture sans etag : 409, on n'écrit pas à l'aveugle", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    orders.withoutEtag = true;
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "buyer",
      by: ACHETEUSE,
      note: "motif",
    });
    expect(r).toEqual({ ok: false, error: CONFLIT, code: 409 });
    expect(rembourser).not.toHaveBeenCalled();
    expect(orders.writes).toEqual([]);
  });

  it("conflit APRÈS remboursement : annulation imposée, admins alertés, effets normaux", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    ecrivainConcurrent({ remindShipAt: T0 - 1 });

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "buyer",
      by: ACHETEUSE,
      note: "Plus besoin",
    });

    expect(r.ok).toBe(true);
    const o = lue();
    expect(o).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      refundedAt: T0,
      remindShipAt: T0 - 1, // l'écriture concurrente n'est pas écrasée
      cancelReason: "Plus besoin",
    });
    expect(o.history?.at(-1)).toMatchObject({
      from: "payee",
      to: "annulee",
      by: ACHETEUSE,
      note: "Annulation imposée par le remboursement (conflit d'écriture)",
    });
    expect(alertes().map((a) => a.text)).toEqual([
      `Conflit sur la commande ${ORDER_ID} : remboursement effectué, annulation imposée`,
    ]);
    expect(textes(ACHETEUSE)).toEqual([
      "Ta commande est annulée — la pièce est remise en vente",
    ]);
    expect(piece().status).toBe("available");
  });

  it("conflit après remboursement, le vendeur a expédié entre-temps : annulée, pièce NON remise en vente, pas de « remise en vente » annoncée", async () => {
    // le cron annule à J+7 (remboursement fait) pendant que le vendeur expédie
    poser({ status: "payee", paidAt: T0 - 7 * DAY });
    ecrivainConcurrent({
      status: "expediee",
      shippedAt: T0,
      shipment: { tracking: "31234567", at: T0 },
    });

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "system",
      by: "system",
      note: "Annulation automatique — pièce non expédiée sous 7 jours",
    });

    expect(r.ok).toBe(true);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      shipment: { tracking: "31234567" },
    });
    expect(lue().history?.at(-1)).toMatchObject({
      from: "expediee",
      to: "annulee",
    });
    // la pièce est dans le colis : elle ne revient pas en vente
    expect(piece().status).toBe("sold");
    expect(notifsDe(notifs, ACHETEUSE)).toEqual([]);
    expect(notifsDe(notifs, VENDEUR)).toEqual([]);
    expect(alertes().map((a) => a.text)).toEqual([
      `Conflit sur la commande ${ORDER_ID} : remboursement effectué, annulation imposée alors que la commande était passée en « expediee » — pièce NON remise en vente, prévenir l'acheteur et le vendeur`,
    ]);
  });

  it("conflit après remboursement, virement écrit entre-temps par le concurrent : remboursement après versement noté et signalé", async () => {
    // deux admins : l'un clôt (le vendeur est payé), l'autre annule
    poser({
      status: "litige",
      dispute: { reason: "non_conforme", at: T0 - DAY },
    });
    ecrivainConcurrent({
      status: "terminee",
      payout: {
        status: "envoye",
        amountCents: 11399,
        id: "po_concurrent",
        at: T0,
        attempts: 1,
        createTries: 0,
      },
    });

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_cancel",
      role: "admin",
      by: "admin",
      note: "Pièce non conforme",
    });

    expect(r.ok).toBe(true);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      payout: { status: "envoye", id: "po_concurrent" },
      refundAfterPayout: { at: T0 },
    });
    expect(piece().status).toBe("sold");
    const textesAlertes = alertes().map((a) => a.text);
    expect(textesAlertes).toContain(
      `Remboursement après versement — commande ${ORDER_ID} : la part vendeur a été reprise sur un solde déjà versé (solde négatif, SOLANGE en répond)`,
    );
    expect(textesAlertes).toContain(
      `Conflit sur la commande ${ORDER_ID} : remboursement effectué, annulation imposée alors que la commande était passée en « terminee » — pièce NON remise en vente, prévenir l'acheteur et le vendeur`,
    );
  });

  it("conflit après remboursement, mais déjà annulée par le concurrent : 409 sans doublon", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    ecrivainConcurrent({
      status: "annulee",
      refundId: "re_test",
      refundedAt: T0,
    });

    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "cancel",
      role: "buyer",
      by: ACHETEUSE,
      note: "Double clic",
    });
    expect(r).toEqual({ ok: false, error: CONFLIT, code: 409 });
    expect(alertes()).toEqual([]);
    expect(notifsDe(notifs, ACHETEUSE)).toEqual([]);
  });
});

describe("colis perdu (litige « non reçu » tranché par l'équipe)", () => {
  const litige = (reason: string) =>
    poser({
      status: "litige",
      shippedAt: T0 - 10 * DAY,
      shipment: {
        carrier: "Mondial Relay · Point Relais ou Locker",
        tracking: "31234567",
        at: T0 - 10 * DAY,
      },
      dispute: { reason, at: T0 - 2 * DAY },
    });

  it("remboursement, pièce NON remise en vente, « colis_perdu » aux deux parties", async () => {
    litige("non_recue");
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_cancel",
      role: "admin",
      by: "admin",
      lost: true,
    });

    expect(r.ok).toBe(true);
    expect(rembourser).toHaveBeenCalledTimes(1);
    expect(lue()).toMatchObject({
      status: "annulee",
      refundId: "re_test",
      lostParcel: { at: T0, by: "admin" },
      cancelReason: "Colis perdu",
    });
    expect(piece().status).toBe("sold");

    expect(textes(ACHETEUSE)).toEqual([
      "Colis perdu : tu es intégralement remboursé",
    ]);
    expect(textes(VENDEUR)).toEqual([
      "Colis déclaré perdu — déclare la perte à Mondial Relay",
    ]);

    const plafond = `${CARRIERS.mondial_relay.lossCompensationCents / 100} €`;
    expect(plafond).toBe("25 €");
    const mails = emailsEnvoyes(fetchMock);
    expect(mails.map((m) => m.to).sort()).toEqual([
      "lou@exemple.fr",
      "maya@exemple.fr",
    ]);
    for (const m of mails) {
      expect(m.subject).toBe("Colis perdu — Lemaire Veste croisée");
      expect(m.html).toContain(`indemnisation forfaitaire de ${plafond}`);
      expect(m.html).toContain(CARRIERS.mondial_relay.claimUrl);
      expect(m.html).toContain("31234567");
      expect(m.html).toContain("intégralement remboursé");
      expect(m.html).not.toContain("remise en vente");
    }
    expect(textes(ACHETEUSE).join(" ")).not.toContain("remise en vente");
  });

  it("refusé sur un litige « non conforme » : 409, rien remboursé, rien écrit", async () => {
    litige("non_conforme");
    orders.writes.length = 0;
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_cancel",
      role: "admin",
      by: "admin",
      lost: true,
    });
    expect(r).toEqual({
      ok: false,
      error: "Colis perdu : seulement sur un litige « non reçu »",
      code: 409,
    });
    expect(rembourser).not.toHaveBeenCalled();
    expect(orders.writes).toEqual([]);
    expect(lue().status).toBe("litige");
  });

  it("refusé hors resolve_cancel admin", async () => {
    litige("non_recue");
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "resolve_close",
      role: "admin",
      by: "admin",
      lost: true,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe(409);
    expect(lue().status).toBe("litige");
  });
});

describe("expédition : numéro de suivi obligatoire", () => {
  it("sans suivi : 400, statut inchangé, aucune écriture", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    orders.writes.length = 0;
    for (const tracking of [undefined, "", "12345", "31234567€"]) {
      const r = await applyTransition({
        orderId: ORDER_ID,
        action: "ship",
        role: "seller",
        by: VENDEUR,
        tracking,
      });
      expect(r).toEqual({
        ok: false,
        error:
          "Indique le numéro de suivi de ton étiquette (6 à 40 lettres ou chiffres).",
        code: 400,
      });
    }
    expect(orders.writes).toEqual([]);
    expect(lue().status).toBe("payee");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suivi normalisé ; l'acheteur reçoit le numéro, la page de suivi et la protection", async () => {
    poser({ status: "payee", paidAt: T0 - DAY });
    const r = await applyTransition({
      orderId: ORDER_ID,
      action: "ship",
      role: "seller",
      by: VENDEUR,
      tracking: " 6a 1234-567 ",
    });

    expect(r.ok).toBe(true);
    expect(lue()).toMatchObject({
      status: "expediee",
      shippedAt: T0,
      shipment: {
        tracking: "6A1234567",
        carrier: "Mondial Relay · Point Relais ou Locker",
        at: T0,
      },
    });
    const [mail] = emailsEnvoyes(fetchMock);
    expect(mail.to).toBe("maya@exemple.fr");
    expect(mail.html).toContain("6A1234567");
    expect(mail.html).toContain(`href="${CARRIERS.mondial_relay.trackingUrl}"`);
    expect(CARRIERS.mondial_relay.trackingUrl).not.toContain("?");
    expect(mail.html).toContain(BUYER_PROTECTION_TEXT);
  });
});
