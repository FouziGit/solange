import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  formatCountdownMinutes,
  nextCountdownDelay,
} from "../drop-countdown";

describe("formatCountdown", () => {
  it("affiche heures, minutes et secondes sur deux chiffres", () => {
    expect(formatCountdown(8047)).toBe("02:14:07");
    expect(formatCountdown(59)).toBe("00:00:59");
  });

  it("ne descend jamais sous zéro et ignore les fractions", () => {
    expect(formatCountdown(-5)).toBe("00:00:00");
    expect(formatCountdown(61.9)).toBe("00:01:01");
  });
});

describe("formatCountdownMinutes — Réduire les animations", () => {
  it("arrondit à la minute par défaut : jamais plus de temps qu'il n'en reste", () => {
    expect(formatCountdownMinutes(8047)).toBe("2 h 14 min");
    expect(formatCountdownMinutes(8099)).toBe("2 h 14 min");
    expect(formatCountdownMinutes(8100)).toBe("2 h 15 min");
  });

  it("garde deux chiffres aux minutes, et tait les zéros", () => {
    expect(formatCountdownMinutes(2 * 3600 + 5 * 60)).toBe("2 h 05 min");
    expect(formatCountdownMinutes(2 * 3600 + 30)).toBe("2 h");
    expect(formatCountdownMinutes(14 * 60 + 7)).toBe("14 min");
  });

  it("passe aux jours au-delà de 24 h", () => {
    expect(formatCountdownMinutes(2 * 86400 + 3 * 3600 + 120)).toBe("2 j 3 h");
    expect(formatCountdownMinutes(86400 + 59)).toBe("1 j");
  });

  it("dit « moins d'une minute » plutôt que « 0 min »", () => {
    expect(formatCountdownMinutes(59)).toBe("moins d'une minute");
    expect(formatCountdownMinutes(0)).toBe("moins d'une minute");
    expect(formatCountdownMinutes(-3)).toBe("moins d'une minute");
  });
});

describe("nextCountdownDelay", () => {
  it("à la seconde : attend la fin de la seconde en cours", () => {
    expect(nextCountdownDelay(8_047_300, false)).toBe(300 + 25);
  });

  it("à la minute : attend la fin de la minute en cours, pas 60 s pleines", () => {
    // 2 h 14 min 07,3 s : l'affichage passe à « 2 h 13 min » dans 7,3 s
    expect(nextCountdownDelay(8_047_300, true)).toBe(7_300 + 25);
  });

  it("pile sur une bascule : repasse juste après", () => {
    expect(nextCountdownDelay(8_040_000, true)).toBe(25);
    expect(nextCountdownDelay(3_000, false)).toBe(25);
  });

  it("le délai fait toujours changer la valeur affichée", () => {
    for (const ms of [8_047_300, 8_040_000, 61_001, 999, 60_000]) {
      for (const byMinute of [false, true]) {
        const unit = byMinute ? 60_000 : 1000;
        const after = ms - nextCountdownDelay(ms, byMinute);
        expect(Math.floor(after / unit)).toBeLessThan(Math.floor(ms / unit));
      }
    }
  });

  it("ne rend jamais un délai négatif", () => {
    expect(nextCountdownDelay(-500, true)).toBe(25);
  });
});
