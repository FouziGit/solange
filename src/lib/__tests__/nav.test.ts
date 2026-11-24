import { describe, expect, it } from "vitest";
import {
  dansMarche,
  dernierMessage,
  messageNonLu,
  sansBarreOnglets,
} from "../nav";

describe("dansMarche", () => {
  it("couvre le Marché, la fiche d'une pièce et le paiement", () => {
    expect(dansMarche("/decouvrir")).toBe(true);
    expect(dansMarche("/article/x")).toBe(true);
    expect(dansMarche("/checkout/x")).toBe(true);
  });

  it("laisse le fil et le Journal dehors", () => {
    expect(dansMarche("/")).toBe(false);
    expect(dansMarche("/journal/x")).toBe(false);
  });
});

describe("sansBarreOnglets", () => {
  it("ne retire la barre que sur la fiche d'une pièce", () => {
    expect(sansBarreOnglets("/article/x")).toBe(true);
    expect(sansBarreOnglets("/decouvrir")).toBe(false);
    expect(sansBarreOnglets("/checkout/x")).toBe(false);
    expect(sansBarreOnglets("/")).toBe(false);
  });
});

describe("dernierMessage", () => {
  it("vaut 0 sans notification de message", () => {
    expect(dernierMessage([])).toBe(0);
    expect(dernierMessage([{ type: "sale", at: 50 }])).toBe(0);
  });

  it("donne la date du message le plus récent, les autres types ignorés", () => {
    expect(
      dernierMessage([
        { type: "message", at: 20 },
        { type: "follow", at: 90 },
        { type: "message", at: 40 },
        { type: "message", at: 30 },
      ]),
    ).toBe(40);
  });
});

describe("messageNonLu", () => {
  const message = (at: number, read = false) =>
    ({ type: "message", at, read }) as const;

  it("reste éteint sans message non lu", () => {
    expect(messageNonLu([])).toBe(false);
    expect(messageNonLu([message(10, true)])).toBe(false);
    expect(messageNonLu([{ type: "order", at: 10, read: false }])).toBe(false);
  });

  it("reste éteint pour un message déjà vu dans Messages", () => {
    expect(messageNonLu([message(10)], 10)).toBe(false);
    expect(messageNonLu([message(10)], 25)).toBe(false);
  });

  it("s'allume pour un message arrivé après la dernière visite", () => {
    expect(messageNonLu([message(10), message(30)], 25)).toBe(true);
  });

  it("sans repère, s'allume dès qu'un message est non lu", () => {
    expect(messageNonLu([message(10, true), message(5)])).toBe(true);
  });
});
