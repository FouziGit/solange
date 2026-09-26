import { describe, expect, it } from "vitest";
import {
  canWrite,
  countPriorReports,
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

describe("countPriorReports — changer d'identifiant n'efface pas la récidive", () => {
  const cible = {
    id: "u_0123456789ab",
    handles: new Set(["lou.mercier", "jean.dupont"]),
  };
  const r = (
    targetType: string,
    targetId: string,
    targetUserId?: string | null,
  ) => ({ targetType, targetId, targetUserId });

  it("compte par id, même quand le handle signalé n'existe plus", () => {
    expect(
      countPriorReports([r("user", "ancien.inconnu", "u_0123456789ab")], cible),
    ).toBe(1);
  });

  it("compte les signalements faits sous l'ancien handle", () => {
    expect(countPriorReports([r("user", "jean.dupont")], cible)).toBe(1);
    expect(countPriorReports([r("message", "jean.dupont", null)], cible)).toBe(
      1,
    );
  });

  it("la casse du signalement ne fait pas perdre la trace", () => {
    expect(countPriorReports([r("user", "Jean.Dupont")], cible)).toBe(1);
  });

  it("ignore les contenus : pièce, publication, fil", () => {
    const contenus = [
      r("product", "jean.dupont", "u_0123456789ab"),
      r("post", "jean.dupont", "u_0123456789ab"),
      r("thread", "lou.mercier", "u_0123456789ab"),
    ];
    expect(countPriorReports(contenus, cible)).toBe(0);
  });

  it("ne compte pas un autre membre, ni un signalement sans id quand la cible n'en a pas", () => {
    const autres = [r("user", "quelquun", "u_ffffffffffff"), r("user", "x")];
    expect(countPriorReports(autres, cible)).toBe(0);
    expect(
      countPriorReports([r("user", "quelquun")], { handles: new Set(["lou"]) }),
    ).toBe(0);
  });

  it("additionne sur toute la liste", () => {
    const liste = [
      r("user", "lou.mercier", "u_0123456789ab"),
      r("user", "jean.dupont"),
      r("message", "LOU.MERCIER"),
      r("post", "p_1"),
    ];
    expect(countPriorReports(liste, cible)).toBe(3);
  });
});
