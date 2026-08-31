import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  HOURLY_CAP,
  decidePush,
  groupedText,
  inQuietHours,
  normalizePrefs,
  type PushPrefs,
} from "../push-rules";

const prefs = (over: Partial<PushPrefs> = {}): PushPrefs => ({
  ...DEFAULT_PREFS,
  ...over,
});

describe("inQuietHours", () => {
  it("plage qui passe minuit (22 h → 8 h) : le cas par défaut", () => {
    const p = prefs();
    expect(inQuietHours(p, 23)).toBe(true);
    expect(inQuietHours(p, 3)).toBe(true);
    expect(inQuietHours(p, 7)).toBe(true);
    expect(inQuietHours(p, 8)).toBe(false); // borne haute exclue
    expect(inQuietHours(p, 14)).toBe(false);
    expect(inQuietHours(p, 22)).toBe(true); // borne basse incluse
  });

  it("plage dans la journée (13 h → 15 h)", () => {
    const p = prefs({ quietFrom: 13, quietTo: 15 });
    expect(inQuietHours(p, 12)).toBe(false);
    expect(inQuietHours(p, 13)).toBe(true);
    expect(inQuietHours(p, 14)).toBe(true);
    expect(inQuietHours(p, 15)).toBe(false);
  });

  it("plage vide (from === to) = jamais silencieux", () => {
    const p = prefs({ quietFrom: 9, quietTo: 9 });
    for (const h of [0, 9, 14, 23]) expect(inQuietHours(p, h)).toBe(false);
  });
});

describe("decidePush", () => {
  const ctx = { hour: 14, sentThisHour: 0 };

  it("envoie quand tout est vert", () => {
    expect(decidePush(prefs(), "sale", ctx)).toEqual({
      send: true,
      grouped: false,
    });
  });

  it("respecte la désactivation globale", () => {
    expect(decidePush(prefs({ enabled: false }), "sale", ctx)).toEqual({
      send: false,
      reason: "disabled",
    });
  });

  it("respecte le réglage par type", () => {
    const p = prefs({ types: { ...DEFAULT_PREFS.types, like: false } });
    expect(decidePush(p, "like", ctx)).toEqual({ send: false, reason: "type" });
    // les autres types passent toujours
    expect(decidePush(p, "sale", ctx).send).toBe(true);
  });

  it("se tait pendant les heures calmes", () => {
    expect(decidePush(prefs(), "sale", { ...ctx, hour: 3 })).toEqual({
      send: false,
      reason: "quiet",
    });
  });

  it("s'arrête au plafond horaire", () => {
    expect(
      decidePush(prefs(), "sale", { ...ctx, sentThisHour: HOURLY_CAP }),
    ).toEqual({ send: false, reason: "cap" });
    expect(
      decidePush(prefs(), "sale", { ...ctx, sentThisHour: HOURLY_CAP - 1 })
        .send,
    ).toBe(true);
  });

  it("signale un envoi regroupé", () => {
    expect(decidePush(prefs(), "like", { ...ctx, grouping: true })).toEqual({
      send: true,
      grouped: true,
    });
  });

  it("l'ordre des refus est stable : global > type > calme > plafond", () => {
    const p = prefs({
      enabled: false,
      types: { ...DEFAULT_PREFS.types, sale: false },
    });
    expect(decidePush(p, "sale", { hour: 3, sentThisHour: 99 })).toEqual({
      send: false,
      reason: "disabled",
    });
  });
});

describe("normalizePrefs", () => {
  it("complète un enregistrement vide ou partiel", () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    const partial = normalizePrefs({ enabled: false, types: { like: false } });
    expect(partial.enabled).toBe(false);
    expect(partial.types.like).toBe(false);
    expect(partial.types.sale).toBe(true); // défaut conservé
    expect(partial.quietFrom).toBe(DEFAULT_PREFS.quietFrom);
  });
});

describe("groupedText", () => {
  it("ne groupe rien en dessous de 2", () => {
    expect(groupedText("like", 1)).toBe("");
  });
  it("résume au pluriel", () => {
    expect(groupedText("like", 3)).toBe("3 personnes ont aimé ta pièce");
    expect(groupedText("message", 5)).toBe("5 nouveaux messages");
  });
});
