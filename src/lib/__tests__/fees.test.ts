import { describe, expect, it } from "vitest";
import { feeRate, feeRateBps, splitFee, toCents } from "../fees";

describe("feeRateBps — les quatre paliers, en centimes entiers", () => {
  it("moins de 200 € → 4 %", () => {
    expect(feeRateBps(0)).toBe(400);
    expect(feeRateBps(19_999)).toBe(400);
  });
  it("de 200 € à moins de 500 € → 3,5 %", () => {
    expect(feeRateBps(20_000)).toBe(350);
    expect(feeRateBps(49_999)).toBe(350);
  });
  it("de 500 € à moins de 1 000 € → 2,5 %", () => {
    expect(feeRateBps(50_000)).toBe(250);
    expect(feeRateBps(99_999)).toBe(250);
  });
  it("1 000 € et plus → 2 %", () => {
    expect(feeRateBps(100_000)).toBe(200);
    expect(feeRateBps(500_000)).toBe(200);
  });
  it("un montant négatif ou absurde retombe sur le palier le plus cher", () => {
    expect(feeRateBps(-1)).toBe(400);
  });
});

describe("splitFee — l'invariant qui compte", () => {
  it("commission + part vendeur redonne TOUJOURS le montant, au centime", () => {
    for (let c = 0; c <= 300_000; c += 137) {
      const r = splitFee(c);
      expect(r.feeCents + r.sellerCents).toBe(c);
    }
  });

  it("aucune part n'est négative", () => {
    for (const c of [0, 1, 99, 19_999, 20_000, 100_000]) {
      const r = splitFee(c);
      expect(r.feeCents).toBeGreaterThanOrEqual(0);
      expect(r.sellerCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("calcule les cas de référence", () => {
    expect(splitFee(10_000)).toMatchObject({
      rateBps: 400,
      feeCents: 400,
      sellerCents: 9_600,
    });
    expect(splitFee(20_000)).toMatchObject({
      rateBps: 350,
      feeCents: 700,
      sellerCents: 19_300,
    });
    expect(splitFee(50_000)).toMatchObject({
      rateBps: 250,
      feeCents: 1_250,
      sellerCents: 48_750,
    });
    expect(splitFee(100_000)).toMatchObject({
      rateBps: 200,
      feeCents: 2_000,
      sellerCents: 98_000,
    });
  });

  it("un taux gelé sur la commande l'emporte sur la grille du jour", () => {
    // la grille donnerait 200 bps ; la commande a été passée à 400
    expect(splitFee(100_000, 400).feeCents).toBe(4_000);
  });

  it("tronque les montants fractionnaires plutôt que de propager un flottant", () => {
    expect(splitFee(10_000.7).amountCents).toBe(10_000);
  });
});

describe("toCents — la conversion se fait une fois, et proprement", () => {
  it("ne se laisse pas piéger par la représentation des flottants", () => {
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30
    expect(toCents(1155.55)).toBe(115_555);
    expect(toCents(4.9)).toBe(490);
  });
});

describe("écart avec l'ancien barème en euros — mesuré, pas supposé", () => {
  /* L'ancien calcul vivait en double (src/lib/utils.ts et
     netlify/functions/_shared/seed-catalog.mts) et arrondissait en euros :
     Math.round(prix * taux * 100) / 100. Sur une pile flottante, 641,80 € à
     2,5 % donne 16,044999999999998 et non 16,045 : l'ancien code arrondissait
     donc à 16,04 là où la règle mathématique donne 16,05. Le calcul en
     centimes entiers corrige ce biais. On ne cache pas l'écart, on le borne. */
  const ancienTaux = (p: number) =>
    p < 200 ? 0.04 : p < 500 ? 0.035 : p < 1000 ? 0.025 : 0.02;
  const ancienFeeCents = (cents: number) => {
    const eur = cents / 100;
    return Math.round(eur * ancienTaux(eur) * 100);
  };

  const ecarts: { cents: number; delta: number }[] = [];
  for (let cents = 0; cents <= 300_000; cents += 1) {
    const delta = splitFee(cents).feeCents - ancienFeeCents(cents);
    if (delta !== 0) ecarts.push({ cents, delta });
  }

  it("ne diverge jamais de plus d'un centime", () => {
    expect(ecarts.every((e) => Math.abs(e.delta) === 1)).toBe(true);
  });

  it("ne diverge jamais au détriment du vendeur au-delà d'un centime, et toujours dans le sens de la règle d'arrondi", () => {
    expect(ecarts.every((e) => e.delta === 1)).toBe(true);
  });

  it("ne diverge que sur les demi-centimes exacts, jamais ailleurs", () => {
    for (const e of ecarts) {
      const exact = (e.cents * splitFee(e.cents).rateBps) / 10_000;
      expect(exact - Math.floor(exact)).toBe(0.5);
    }
  });

  it("reste marginal : moins de 0,1 % des montants de 0 à 3 000 €", () => {
    expect(ecarts.length / 300_001).toBeLessThan(0.001);
  });

  it("expose le taux en fraction pour l'affichage", () => {
    expect(feeRate(199)).toBe(0.04);
    expect(feeRate(200)).toBe(0.035);
    expect(feeRate(1000)).toBe(0.02);
  });
});
