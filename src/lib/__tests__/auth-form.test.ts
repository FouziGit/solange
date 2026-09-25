import { describe, expect, it } from "vitest";
import {
  CODE_VALIDITY_MIN,
  RESEND_DELAY_S,
  missingForCode,
  missingMessage,
  resendWait,
} from "../auth-form";
import { MIN_AGE } from "../legal";

describe("missingForCode", () => {
  it("liste ce qui manque, dans l'ordre de l'écran", () => {
    expect(
      missingForCode({ email: "", acceptLegal: false, ageDeclared: false }),
    ).toEqual(["email", "legal", "age"]);
    expect(
      missingForCode({
        email: "a@b.fr",
        acceptLegal: false,
        ageDeclared: true,
      }),
    ).toEqual(["legal"]);
    expect(
      missingForCode({ email: "a@b", acceptLegal: true, ageDeclared: false }),
    ).toEqual(["email", "age"]);
  });

  it("ne manque rien quand tout est rempli (espaces autour tolérés)", () => {
    expect(
      missingForCode({
        email: "  a@b.fr ",
        acceptLegal: true,
        ageDeclared: true,
      }),
    ).toEqual([]);
  });
});

describe("missingMessage", () => {
  it("null quand il ne manque rien : le bouton n'a rien à expliquer", () => {
    expect(missingMessage([])).toBeNull();
  });

  it("une seule action", () => {
    expect(missingMessage(["email"])).toBe(
      "Pour recevoir le code, entre une adresse email valide.",
    );
    expect(missingMessage(["age"])).toBe(
      `Pour recevoir le code, déclare avoir ${MIN_AGE} ans ou plus.`,
    );
  });

  it("plusieurs actions : virgules puis « et »", () => {
    expect(missingMessage(["legal", "age"])).toBe(
      `Pour recevoir le code, accepte les conditions et déclare avoir ${MIN_AGE} ans ou plus.`,
    );
    expect(missingMessage(["email", "legal", "age"])).toBe(
      `Pour recevoir le code, entre une adresse email valide, accepte les conditions et déclare avoir ${MIN_AGE} ans ou plus.`,
    );
  });
});

describe("resendWait", () => {
  it("0 tant qu'aucun code n'a été envoyé", () => {
    expect(resendWait(null, 1_000_000)).toBe(0);
  });

  it("décompte en secondes entières, arrondi vers le haut", () => {
    const t = 1_000_000;
    expect(resendWait(t, t)).toBe(RESEND_DELAY_S);
    expect(resendWait(t, t + 500)).toBe(RESEND_DELAY_S);
    expect(resendWait(t, t + 1_000)).toBe(RESEND_DELAY_S - 1);
    expect(resendWait(t, t + 59_001)).toBe(1);
  });

  it("jamais négatif une fois le délai passé", () => {
    const t = 1_000_000;
    expect(resendWait(t, t + RESEND_DELAY_S * 1000)).toBe(0);
    expect(resendWait(t, t + 10 * 60_000)).toBe(0);
  });
});

describe("délais affichés", () => {
  it("reprennent ceux du serveur (auth-send-code.mts)", () => {
    expect(CODE_VALIDITY_MIN).toBe(10);
    expect(RESEND_DELAY_S).toBe(60);
  });
});
