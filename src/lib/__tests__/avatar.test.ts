import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_SIDE,
  imgIdFromPath,
  isAvatarPath,
  isJpeg,
  sanitizeJpeg,
  squareCropRect,
} from "../avatar";

describe("squareCropRect — un carré centré, jamais agrandi", () => {
  it("photo paysage 4000 × 3000 : on rogne les côtés, on réduit à 512", () => {
    expect(squareCropRect(4000, 3000)).toEqual({
      sx: 500,
      sy: 0,
      side: 3000,
      out: 512,
    });
  });
  it("photo portrait : on rogne le haut et le bas", () => {
    expect(squareCropRect(3000, 4000)).toEqual({
      sx: 0,
      sy: 500,
      side: 3000,
      out: 512,
    });
  });
  it("petite image 300 × 200 : sortie à 200, pas d'agrandissement", () => {
    expect(squareCropRect(300, 200)).toEqual({
      sx: 50,
      sy: 0,
      side: 200,
      out: 200,
    });
  });
});

describe("isAvatarPath — seule une image servie par /api/img est acceptée", () => {
  it("accepte le chemin produit par le serveur", () => {
    expect(isAvatarPath("/api/img/i_0123456789ab")).toBe(true);
    expect(imgIdFromPath("/api/img/i_0123456789ab")).toBe("i_0123456789ab");
  });
  it("refuse ce qui sortirait du dossier ou exécuterait du code", () => {
    for (const v of [
      "/api/img/../x",
      "javascript:alert(1)",
      "https://exemple.fr/api/img/i_0123456789ab",
      "/api/img/i_0123456789ab?x=1",
      "/api/img/i_0123456789AB",
      "",
      null,
      42,
    ]) {
      expect(isAvatarPath(v), String(v)).toBe(false);
      expect(imgIdFromPath(v)).toBeNull();
    }
  });
});

/* ---------- un JPEG construit à la main ---------- */

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const seg = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
};
const sof0 = (w: number, h: number) =>
  seg(0xc0, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);

const SOI = [0xff, 0xd8];
const APP0 = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1 = seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS 48.8566N 2.3522E")]);
const APP2 = seg(0xe2, [...ascii("ICC_PROFILE"), 0, 1, 1, 0xaa, 0xbb, 0xcc]);
const COM = seg(0xfe, ascii("iPhone de Jean"));
const DQT = seg(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]);
const DHT = seg(0xc4, [0, 0, 1, ...Array.from({ length: 14 }, () => 0), 0]);
const SOS = seg(0xda, [1, 1, 0, 0, 0x3f, 0]);
/* données de passe avec un octet échappé (FF00) et un redémarrage (RST0) :
   ni l'un ni l'autre ne termine la passe */
const SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78];
const EOI = [0xff, 0xd9];
const TAIL = ascii("GPS-APRES!");

const jpeg = (...parts: number[][]) => new Uint8Array(parts.flat());
const FULL = () =>
  jpeg(SOI, APP0, APP1, APP2, COM, DQT, sof0(16, 16), DHT, SOS, SCAN, EOI, TAIL);

function contains(hay: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++)
      if (hay[i + k] !== needle[k]) continue outer;
    return true;
  }
  return false;
}

describe("isJpeg", () => {
  it("reconnaît la signature FF D8 FF", () => {
    expect(isJpeg(FULL())).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(isJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe("sanitizeJpeg — la localisation ne quitte jamais le téléphone", () => {
  const r = sanitizeJpeg(FULL());

  it("lit la taille annoncée par l'en-tête d'image", () => {
    expect(r).not.toBeNull();
    expect(r?.width).toBe(16);
    expect(r?.height).toBe(16);
  });

  it("retire l'EXIF (et ses coordonnées GPS), le commentaire et la queue", () => {
    const out = r!.bytes;
    expect(contains(out, ascii("Exif"))).toBe(false);
    expect(contains(out, ascii("GPS"))).toBe(false);
    expect(contains(out, ascii("iPhone"))).toBe(false);
    expect(Array.from(out.slice(-2))).toEqual(EOI);
  });

  it("recopie à l'identique JFIF, profil couleur, tables et passe", () => {
    expect(Array.from(r!.bytes)).toEqual([
      ...SOI,
      ...APP0,
      ...APP2,
      ...DQT,
      ...sof0(16, 16),
      ...DHT,
      ...SOS,
      ...SCAN,
      ...EOI,
    ]);
  });

  it("accepte plusieurs passes (JPEG progressif)", () => {
    const out = sanitizeJpeg(
      jpeg(SOI, DQT, sof0(16, 16), DHT, SOS, SCAN, DHT, SOS, SCAN, EOI),
    );
    expect(out?.bytes.length).toBe(
      SOI.length +
        DQT.length +
        sof0(16, 16).length +
        2 * (DHT.length + SOS.length + SCAN.length) +
        EOI.length,
    );
  });

  it("retire un APP0 qui n'est pas JFIF nu, et un APP2 qui n'est pas ICC", () => {
    const jfxx = seg(0xe0, [...ascii("JFXX"), 0, 0x10, 0xde, 0xad]);
    const vignette = seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 9, 9, 9]);
    const mpf = seg(0xe2, [...ascii("MPF"), 0, 0xbe, 0xef]);
    const out = sanitizeJpeg(
      jpeg(SOI, jfxx, vignette, mpf, DQT, sof0(16, 16), DHT, SOS, SCAN, EOI),
    );
    expect(Array.from(out!.bytes)).toEqual([
      ...SOI,
      ...DQT,
      ...sof0(16, 16),
      ...DHT,
      ...SOS,
      ...SCAN,
      ...EOI,
    ]);
  });

  it("garde le segment Adobe (conversion de couleurs)", () => {
    const adobe = seg(0xee, [...ascii("Adobe"), 0, 100, 0, 0, 0, 0, 1]);
    const out = sanitizeJpeg(jpeg(SOI, adobe, DQT, sof0(16, 16), SOS, SCAN, EOI));
    expect(contains(out!.bytes, adobe)).toBe(true);
  });

  it("refuse un fichier tronqué", () => {
    const full = FULL();
    const debutDqt = SOI.length + APP0.length + APP1.length + APP2.length + COM.length;
    expect(sanitizeJpeg(full.slice(0, debutDqt + 10))).toBeNull();
    expect(sanitizeJpeg(full.slice(0, full.length - TAIL.length - 3))).toBeNull();
  });

  it("refuse un fichier sans fin (EOI)", () => {
    expect(
      sanitizeJpeg(jpeg(SOI, APP0, DQT, sof0(16, 16), DHT, SOS, SCAN)),
    ).toBeNull();
  });

  it("refuse une image trop grande ou de taille nulle", () => {
    const big = AVATAR_MAX_SIDE * 2;
    expect(
      sanitizeJpeg(jpeg(SOI, DQT, sof0(big, big), DHT, SOS, SCAN, EOI)),
    ).toBeNull();
    expect(
      sanitizeJpeg(jpeg(SOI, DQT, sof0(4096, 4096), DHT, SOS, SCAN, EOI)),
    ).toBeNull();
    expect(
      sanitizeJpeg(jpeg(SOI, DQT, sof0(16, 0), DHT, SOS, SCAN, EOI)),
    ).toBeNull();
  });

  it("refuse l'absence d'en-tête d'image, ou deux en-têtes", () => {
    expect(sanitizeJpeg(jpeg(SOI, DQT, DHT, SOS, SCAN, EOI))).toBeNull();
    expect(
      sanitizeJpeg(jpeg(SOI, sof0(16, 16), sof0(32, 32), SOS, SCAN, EOI)),
    ).toBeNull();
  });

  it("refuse un marqueur inconnu ou des octets entre deux segments", () => {
    const inconnu = seg(0xc8, [1, 2]); // JPG, réservé
    expect(
      sanitizeJpeg(jpeg(SOI, inconnu, DQT, sof0(16, 16), SOS, SCAN, EOI)),
    ).toBeNull();
    expect(
      sanitizeJpeg(jpeg(SOI, [0x00], DQT, sof0(16, 16), SOS, SCAN, EOI)),
    ).toBeNull();
  });

  it("refuse ce qui n'est pas un JPEG", () => {
    expect(sanitizeJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
