import { describe, expect, it } from "vitest";
import {
  canWrite,
  isAdmin,
  writeBlockedMessage,
  type ModeratedUser,
} from "../moderation";

const u = (over: Partial<ModeratedUser> = {}): ModeratedUser => ({
  id: "u_1",
  email: "fouzi.benzidane@gmail.com",
  ...over,
});

describe("isAdmin", () => {
  const LIST = "fouzi.benzidane@gmail.com,youssef@example.com";

  it("reconnaît un email de la liste", () => {
    expect(isAdmin(u(), LIST)).toBe(true);
  });

  it("tolère casse et espaces (une liste s'écrit à la main)", () => {
    expect(isAdmin(u({ email: "  FOUZI.Benzidane@Gmail.com " }), LIST)).toBe(
      true,
    );
    expect(
      isAdmin(u(), " fouzi.benzidane@gmail.com , youssef@example.com "),
    ).toBe(true);
  });

  it("refuse un email absent de la liste", () => {
    expect(isAdmin(u({ email: "quelquun@example.com" }), LIST)).toBe(false);
  });

  it("refuse quand la liste est vide ou absente", () => {
    expect(isAdmin(u(), "")).toBe(false);
    expect(isAdmin(u(), undefined)).toBe(false);
  });

  it("accepte un rôle posé sur le compte (compat D-018)", () => {
    expect(isAdmin(u({ email: "autre@example.com", role: "admin" }), "")).toBe(
      true,
    );
  });

  it("un banni n'est JAMAIS admin, même listé ou avec le rôle", () => {
    expect(isAdmin(u({ banned: true }), LIST)).toBe(false);
    expect(isAdmin(u({ role: "admin", banned: true }), LIST)).toBe(false);
  });

  it("refuse l'absence de compte", () => {
    expect(isAdmin(null, LIST)).toBe(false);
  });

  it("ne se laisse pas berner par une sous-chaîne", () => {
    // un email qui CONTIENT celui d'un admin ne doit pas passer
    expect(
      isAdmin(u({ email: "fouzi.benzidane@gmail.com.attaquant.fr" }), LIST),
    ).toBe(false);
  });
});

describe("canWrite", () => {
  const now = 1_800_000_000_000;

  it("laisse écrire un compte normal", () => {
    expect(canWrite(u(), now)).toEqual({ allowed: true });
  });

  it("bloque un banni", () => {
    expect(canWrite(u({ banned: true }), now)).toEqual({
      allowed: false,
      reason: "banned",
    });
  });

  it("bloque pendant la suspension, libère après l'échéance", () => {
    const until = now + 86_400_000;
    expect(canWrite(u({ suspendedUntil: until }), now)).toEqual({
      allowed: false,
      reason: "suspended",
      until,
    });
    // une seconde après l'échéance : de nouveau libre, sans intervention
    expect(canWrite(u({ suspendedUntil: now - 1 }), now)).toEqual({
      allowed: true,
    });
  });

  it("le bannissement prime sur une suspension expirée", () => {
    expect(canWrite(u({ banned: true, suspendedUntil: now - 1 }), now)).toEqual(
      { allowed: false, reason: "banned" },
    );
  });
});

describe("writeBlockedMessage", () => {
  it("dit la date de fin quand elle existe", () => {
    const until = Date.UTC(2026, 8, 15, 12);
    expect(
      writeBlockedMessage({ allowed: false, reason: "suspended", until }),
    ).toContain("15 septembre");
  });
  it("reste sobre pour un bannissement", () => {
    expect(writeBlockedMessage({ allowed: false, reason: "banned" })).toBe(
      "Ce compte ne peut plus publier sur SOLANGE.",
    );
  });
});
