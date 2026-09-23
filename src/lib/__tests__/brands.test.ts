import { describe, expect, it } from "vitest";
import { MARQUES, normaliserMarque, suggestions } from "../brands";

describe("base de marques", () => {
  it("contient de quoi couvrir les deux univers", () => {
    expect(suggestions("mode").length).toBeGreaterThan(150);
    expect(suggestions("parfum").length).toBeGreaterThan(60);
  });

  it("ne propose aucun doublon", () => {
    const noms = MARQUES.map((m) => m.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("est triée pour un lecteur français", () => {
    const noms = MARQUES.map((m) => m.nom);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, "fr")));
  });

  it("sans univers, propose tout", () => {
    expect(suggestions().length).toBe(MARQUES.length);
  });
});

describe("normaliserMarque — trois saisies, une seule marque", () => {
  it("rattrape la casse", () => {
    for (const v of ["nike", "NIKE", "Nike", "  nIkE "]) {
      expect(normaliserMarque(v)).toBe("Nike");
    }
  });

  it("rattrape la ponctuation", () => {
    expect(normaliserMarque("apc")).toBe("A.P.C.");
    expect(normaliserMarque("A P C")).toBe("A.P.C.");
  });

  it("rattrape les accents", () => {
    expect(normaliserMarque("hermes")).toBe("Hermès");
    expect(normaliserMarque("chloe")).toBe("Chloé");
  });

  it("laisse passer ce qu'elle ne connaît pas, sans l'écraser", () => {
    expect(normaliserMarque("Ma petite marque")).toBe("Ma petite marque");
  });

  it("rend une chaîne vide sur une saisie vide", () => {
    expect(normaliserMarque("   ")).toBe("");
    expect(normaliserMarque("")).toBe("");
  });

  it("ne confond pas deux maisons proches", () => {
    expect(normaliserMarque("Dior")).toBe("Dior");
    expect(normaliserMarque("Dior Parfums")).toBe("Dior Parfums");
  });
});
