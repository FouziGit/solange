import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { shippingCents } from "../shipping";

/* Client API de D-037 (port à la taille du colis, vendeur payé après
   livraison) : ce que chaque appel envoie au serveur. fetch est remplacé
   par une doublure, comme dans api-profile.test.ts. */

type Call = { url: string; init?: RequestInit };

function stubFetch(
  reply: (url: string, init?: RequestInit) => { status: number; body: unknown },
): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = reply(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return calls;
}

const corps = (c: Call) => JSON.parse(String(c.init?.body)) as unknown;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.order — le port affiché part avec la commande", () => {
  it("envoie expectedShippingCents avec le reste du récapitulatif", async () => {
    const calls = stubFetch(() => ({
      status: 200,
      body: { ok: true, order: { id: "o_1" }, checkoutUrl: null },
    }));
    const port = shippingCents("mondial_relay", "grand");
    await api.order(
      "p_1",
      "mondial_relay",
      "Relais — Tabac",
      undefined,
      true,
      port,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/orders");
    expect(calls[0].init?.method).toBe("POST");
    expect(corps(calls[0])).toEqual({
      productId: "p_1",
      shippingMethod: "mondial_relay",
      relayLabel: "Relais — Tabac",
      acceptCgv: true,
      expectedShippingCents: 799,
    });
  });

  it("sans port attendu, la clé n'est pas envoyée", async () => {
    const calls = stubFetch(() => ({ status: 200, body: { ok: true } }));
    await api.order("p_1", "mondial_relay");
    expect(corps(calls[0])).not.toHaveProperty("expectedShippingCents");
  });

  it("un 409 « prix du port » garde le message du serveur", async () => {
    stubFetch(() => ({
      status: 409,
      body: {
        error:
          "Le prix du port a changé — recharge la page pour voir le nouveau montant",
      },
    }));
    const res = await api.order(
      "p_1",
      "mondial_relay",
      undefined,
      undefined,
      true,
      415,
    );
    expect(res).toMatchObject({
      ok: false,
      status: 409,
      error:
        "Le prix du port a changé — recharge la page pour voir le nouveau montant",
    });
  });
});

describe("api.createProduct — la taille du colis est envoyée", () => {
  it("packageSize part avec l'annonce", async () => {
    const calls = stubFetch(() => ({
      status: 200,
      body: { ok: true, product: { id: "p_1" } },
    }));
    await api.createProduct({
      name: "Veste croisée",
      brand: "Lemaire",
      category: "vestes",
      condition: "Très bon état",
      size: "M",
      priceEUR: 120,
      images: ["/api/img/i_1"],
      packageSize: "tres_grand",
    });
    expect(calls[0].url).toBe("/api/products");
    expect(calls[0].init?.method).toBe("POST");
    expect(corps(calls[0])).toMatchObject({ packageSize: "tres_grand" });
  });
});

describe("api.modRetryPayout — le forçage n'est envoyé que s'il est demandé", () => {
  it("sans override : { op: 'payout', orderId } seulement", async () => {
    const calls = stubFetch(() => ({
      status: 200,
      body: { ok: true, payout: null },
    }));
    await api.modRetryPayout("o_1");
    await api.modRetryPayout("o_2", false);
    expect(calls.map((c) => c.url)).toEqual(["/api/admin", "/api/admin"]);
    expect(corps(calls[0])).toEqual({ op: "payout", orderId: "o_1" });
    expect(corps(calls[1])).toEqual({ op: "payout", orderId: "o_2" });
  });

  it("avec override : overrideBankDispute: true", async () => {
    const calls = stubFetch(() => ({
      status: 200,
      body: { ok: true, payout: null },
    }));
    await api.modRetryPayout("o_1", true);
    expect(calls[0].init?.method).toBe("POST");
    expect(corps(calls[0])).toEqual({
      op: "payout",
      orderId: "o_1",
      overrideBankDispute: true,
    });
  });
});

describe("api.modDispute — décision « colis perdu »", () => {
  it("envoie decision 'lost' telle quelle", async () => {
    const calls = stubFetch(() => ({ status: 200, body: { ok: true } }));
    await api.modDispute("o_1", "lost", "Perte confirmée par Mondial Relay");
    expect(calls[0].url).toBe("/api/admin");
    expect(corps(calls[0])).toEqual({
      op: "dispute",
      orderId: "o_1",
      decision: "lost",
      note: "Perte confirmée par Mondial Relay",
    });
  });
});
