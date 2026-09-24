import { describe, expect, it } from "vitest";
import { montants, sellerPayable, PRIX_MAX_EUR } from "../payments";

describe("montants — qui reçoit quoi", () => {
  it("commission + part vendeur = total, au centime, sur toute la plage", () => {
    for (let prix = 100; prix <= 300_000; prix += 997) {
      for (const port of [0, 390, 690]) {
        const m = montants(prix, port);
        expect(m.applicationFeeCents + m.sellerCents).toBe(m.totalCents);
      }
    }
  });

  it("cas de référence : une pièce à 100 €, port 3,90 €", () => {
    const m = montants(10_000, 390);
    expect(m.commissionCents).toBe(400); // 4 %
    expect(m.serviceCents).toBe(500); // 5 %
    expect(m.totalCents).toBe(10_890); // 100 + 5 + 3,90
    expect(m.applicationFeeCents).toBe(900); // 4 + 5
    expect(m.sellerCents).toBe(9_990); // 100 − 4 + 3,90
  });

  it("le vendeur touche les frais de port : c'est lui qui expédie", () => {
    const sans = montants(10_000, 0);
    const avec = montants(10_000, 690);
    expect(avec.sellerCents - sans.sellerCents).toBe(690);
  });

  it("le taux gelé sur la commande l'emporte sur la grille du jour", () => {
    expect(montants(100_000, 0, 400).commissionCents).toBe(4_000);
  });

  it("aucune part n'est négative", () => {
    for (const p of [0, 1, 50, 19_999, 20_000]) {
      const m = montants(p, 0);
      expect(m.sellerCents).toBeGreaterThanOrEqual(0);
      expect(m.applicationFeeCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("la commission reste celle de fees.ts — une seule source", () => {
    expect(montants(20_000, 0).rateBps).toBe(350);
    expect(montants(100_000, 0).rateBps).toBe(200);
  });
});

describe("sellerPayable", () => {
  it("exige la capacité transfers ACTIVE", () => {
    expect(sellerPayable({ capabilities: { transfers: "active" } })).toBe(true);
  });
  it("refuse pending, inactive, absente", () => {
    for (const t of ["pending", "inactive", null, undefined]) {
      expect(sellerPayable({ capabilities: { transfers: t as string } })).toBe(
        false,
      );
    }
    expect(sellerPayable(null)).toBe(false);
    expect(sellerPayable({})).toBe(false);
  });
});

describe("PRIX_MAX_EUR — ce qui a été déclaré à Stripe", () => {
  it("reste sous 10 000 $ même avec un euro fort", () => {
    // 1,20 $ pour 1 € : un cours plus haut que tout ce qu'on a vu depuis 2008
    expect(PRIX_MAX_EUR * 1.2).toBeLessThan(10_000);
  });
});
