import { describe, expect, it } from "vitest";
import { TRANSCRIPT_MAX, cleanTranscript } from "../transcript";

describe("cleanTranscript", () => {
  it("reste facultative : absente, nulle ou vide → aucun champ stocké", () => {
    expect(cleanTranscript(undefined)).toEqual({ ok: true });
    expect(cleanTranscript(null)).toEqual({ ok: true });
    expect(cleanTranscript("")).toEqual({ ok: true });
    expect(cleanTranscript("   \n\t ")).toEqual({ ok: true });
  });

  it("retire les espaces de bord et garde le texte intérieur intact", () => {
    expect(
      cleanTranscript("  Taille M, jamais portée.\nUn fil tiré.  "),
    ).toEqual({ ok: true, value: "Taille M, jamais portée.\nUn fil tiré." });
  });

  it("accepte exactement la limite", () => {
    const r = cleanTranscript("a".repeat(TRANSCRIPT_MAX));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(TRANSCRIPT_MAX);
  });

  it("mesure la longueur APRÈS le trim", () => {
    const r = cleanTranscript(`  ${"a".repeat(TRANSCRIPT_MAX)}  `);
    expect(r.ok).toBe(true);
  });

  it("refuse au-delà de la limite, avec le chiffre exact", () => {
    const r = cleanTranscript("a".repeat(TRANSCRIPT_MAX + 345));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/2\s345 caractères/);
      expect(r.message).toMatch(/2\s000 maximum/);
    }
  });

  it("refuse ce qui n'est pas du texte", () => {
    expect(cleanTranscript(42).ok).toBe(false);
    expect(cleanTranscript(["a"]).ok).toBe(false);
    expect(cleanTranscript({ text: "a" }).ok).toBe(false);
  });
});
