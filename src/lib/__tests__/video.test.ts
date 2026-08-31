import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  checkVideo,
  parseRange,
} from "../video";

describe("checkVideo", () => {
  const mp4 = { type: "video/mp4", size: 1_000_000 };

  it("accepte un MP4 court et léger", () => {
    expect(checkVideo(mp4, 10)).toEqual({ ok: true });
  });

  it("refuse un format non lu, en nommant ce qu'on attend", () => {
    const r = checkVideo({ type: "video/avi", size: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("type");
      expect(r.message).toContain("MP4");
    }
  });

  it("refuse le trop lourd AVEC le chiffre exact (on doit savoir quoi corriger)", () => {
    const r = checkVideo({ type: "video/mp4", size: 6_200_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("size");
      expect(r.message).toContain("6,2 Mo");
      expect(r.message).toContain("4 Mo");
    }
  });

  it("refuse le trop long avec la durée réelle", () => {
    const r = checkVideo(mp4, 31);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("duration");
      expect(r.message).toContain("31 s");
    }
  });

  it("ne juge pas la durée tant qu'elle est inconnue", () => {
    expect(checkVideo(mp4).ok).toBe(true);
  });

  it("accepte pile aux limites", () => {
    expect(
      checkVideo(
        { type: "video/mp4", size: MAX_VIDEO_BYTES },
        MAX_VIDEO_SECONDS,
      ).ok,
    ).toBe(true);
  });
});

describe("parseRange — sans quoi aucune vidéo ne se lit sur iPhone", () => {
  const SIZE = 1000;

  it("absence d'en-tête = servir tout", () => {
    expect(parseRange(null, SIZE)).toBeNull();
  });

  it("la sonde de Safari : bytes=0-1", () => {
    expect(parseRange("bytes=0-1", SIZE)).toEqual({
      start: 0,
      end: 1,
      length: 2,
    });
  });

  it("plage ouverte : bytes=500- → jusqu'à la fin", () => {
    expect(parseRange("bytes=500-", SIZE)).toEqual({
      start: 500,
      end: 999,
      length: 500,
    });
  });

  it("suffixe : bytes=-200 → les 200 derniers octets", () => {
    expect(parseRange("bytes=-200", SIZE)).toEqual({
      start: 800,
      end: 999,
      length: 200,
    });
  });

  it("borne de fin au-delà du fichier : on rabote au lieu d'échouer", () => {
    expect(parseRange("bytes=900-5000", SIZE)).toEqual({
      start: 900,
      end: 999,
      length: 100,
    });
  });

  it("plages invalides → 416", () => {
    for (const h of [
      "bytes=1000-", // début hors fichier
      "bytes=500-100", // fin avant début
      "bytes=", // vide
      "octets=0-1", // unité inconnue
      "bytes=-0", // suffixe nul
    ])
      expect(parseRange(h, SIZE)).toBe("invalid");
  });
});
