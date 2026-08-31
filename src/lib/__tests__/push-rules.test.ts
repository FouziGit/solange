import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  HOURLY_CAP,
  decidePush,
  groupedText,
  inQuietHours,
  isAllowedPushEndpoint,
  normalizePrefs,
  parisHour,
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
    expect(decidePush(prefs(), "sale", ctx)).toEqual({ send: true });
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

  it("une plage calme vide (from === to) ne désactive PAS la protection horaire", () => {
    // le contournement trouvé en revue : régler 0 h → 0 h supprime les
    // heures calmes, mais le plafond doit rester la dernière barrière
    const p = prefs({ quietFrom: 0, quietTo: 0 });
    expect(decidePush(p, "like", { hour: 3, sentThisHour: 0 }).send).toBe(true);
    expect(
      decidePush(p, "like", { hour: 3, sentThisHour: HOURLY_CAP }),
    ).toEqual({ send: false, reason: "cap" });
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

describe("isAllowedPushEndpoint — garde anti-SSRF (revue lot 3)", () => {
  it("accepte les vrais services de push des navigateurs", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc123",
      "https://android.googleapis.com/gcm/send/xyz",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QF1r0xY",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ])
      expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it("refuse tout hôte arbitraire — le serveur ne doit relayer personne", () => {
    for (const url of [
      "https://attaquant.example/flood",
      "https://localhost/interne",
      "https://169.254.169.254/latest/meta-data/", // métadonnées cloud
      "http://fcm.googleapis.com/fcm/send/abc", // http nu
      "https://fcm.googleapis.com.attaquant.example/x", // suffixe trompeur
      "pas-une-url",
      "",
    ])
      expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe("parisHour — le bug trouvé en revue", () => {
  it("rend un entier, jamais NaN (fr-FR formate « 03 h »)", () => {
    // 2026-01-15T02:30:00Z = 03 h 30 à Paris (UTC+1)
    const h = parisHour(Date.UTC(2026, 0, 15, 2, 30));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBe(3);
  });

  it("suit l'heure d'été (UTC+2)", () => {
    // 2026-07-15T02:30:00Z = 04 h 30 à Paris
    expect(parisHour(Date.UTC(2026, 6, 15, 2, 30))).toBe(4);
  });

  it("minuit rend 0, pas 24", () => {
    expect(parisHour(Date.UTC(2026, 0, 14, 23, 0))).toBe(0);
  });

  it("une heure calme se déclenche vraiment à 3 h du matin", () => {
    // le bug : NaN faisait échouer inQuietHours en silence
    const at3h = parisHour(Date.UTC(2026, 0, 15, 2, 0));
    expect(inQuietHours(DEFAULT_PREFS, at3h)).toBe(true);
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
