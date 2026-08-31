import { describe, expect, it } from "vitest";
import {
  acceptanceKind,
  acceptancePayloadIsValid,
  buildConsent,
  needsAcceptance,
} from "../legal-consent";
import { LEGAL_VERSION } from "../legal";

describe("acceptancePayloadIsValid", () => {
  it("exige les DEUX cases, explicitement à true", () => {
    expect(
      acceptancePayloadIsValid({ acceptLegal: true, ageDeclared: true }),
    ).toBe(true);
    expect(acceptancePayloadIsValid({ acceptLegal: true })).toBe(false);
    expect(acceptancePayloadIsValid({ ageDeclared: true })).toBe(false);
  });

  it("refuse les valeurs qui « ressemblent » à un oui", () => {
    expect(
      acceptancePayloadIsValid({ acceptLegal: "true", ageDeclared: "true" }),
    ).toBe(false);
    expect(acceptancePayloadIsValid({ acceptLegal: 1, ageDeclared: 1 })).toBe(
      false,
    );
    expect(
      acceptancePayloadIsValid({ acceptLegal: "on", ageDeclared: "on" }),
    ).toBe(false);
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(acceptancePayloadIsValid(null)).toBe(false);
    expect(acceptancePayloadIsValid("oui")).toBe(false);
    expect(acceptancePayloadIsValid(undefined)).toBe(false);
  });
});

describe("buildConsent", () => {
  it("enregistre la version du SERVEUR, jamais celle annoncée par le client", () => {
    expect(buildConsent(1_700_000_000_000)).toEqual({
      version: LEGAL_VERSION,
      at: 1_700_000_000_000,
      age: true,
    });
  });
});

describe("needsAcceptance", () => {
  it("tous les comptes existants doivent accepter : ils n'ont jamais rien accepté", () => {
    expect(needsAcceptance(null)).toBe(true);
    expect(needsAcceptance(undefined)).toBe(true);
  });

  it("une version antérieure déclenche la réacceptation", () => {
    expect(needsAcceptance({ version: 1, at: 0, age: true }, 2)).toBe(true);
  });

  it("la version courante suffit", () => {
    expect(needsAcceptance({ version: 2, at: 0, age: true }, 2)).toBe(false);
  });

  it("une version bricolée plus haute ne redemande rien, mais ne peut pas être écrite par le client", () => {
    expect(needsAcceptance({ version: 99, at: 0, age: true }, 2)).toBe(false);
  });

  it("un enregistrement corrompu est traité comme une absence d'acceptation", () => {
    expect(needsAcceptance({ version: "1" } as unknown as null, 2)).toBe(true);
  });
});

describe("acceptanceKind", () => {
  it("distingue première acceptation et mise à jour", () => {
    expect(acceptanceKind(null)).toBe("first");
    expect(acceptanceKind({ version: 1, at: 0, age: true })).toBe("update");
  });
});
