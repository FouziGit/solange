import { describe, expect, it } from "vitest";
import { filtresLabel, resultatsMarche } from "../marche";

describe("resultatsMarche", () => {
  it("compte les pièces, au singulier comme au pluriel", () => {
    expect(resultatsMarche({ pieces: 1 })).toBe("1 pièce");
    expect(resultatsMarche({ pieces: 12 })).toBe("12 pièces");
  });

  it("ajoute profils et contenus quand une recherche est en cours", () => {
    expect(resultatsMarche({ pieces: 12, profiles: 3, content: 1 })).toBe(
      "12 pièces, 3 profils, 1 contenu",
    );
    expect(resultatsMarche({ pieces: 2, profiles: 0, content: 0 })).toBe(
      "2 pièces, 0 profil, 0 contenu",
    );
  });

  it("dit clairement qu'il n'y a aucune pièce", () => {
    expect(resultatsMarche({ pieces: 0 })).toBe("Aucune pièce ne correspond");
    expect(resultatsMarche({ pieces: 0, profiles: 2, content: 0 })).toBe(
      "Aucune pièce ne correspond. 2 profils, 0 contenu",
    );
  });

  it("donne la cause quand les bornes de prix sont inversées", () => {
    expect(resultatsMarche({ pieces: 0, invertedRange: true })).toBe(
      "Aucune pièce : ton prix minimum dépasse ton maximum",
    );
  });
});

describe("filtresLabel", () => {
  it("n'ajoute rien sans filtre actif", () => {
    expect(filtresLabel(0)).toBe("Filtres avancés (pièces)");
  });

  it("dit le nombre de filtres actifs", () => {
    expect(filtresLabel(1)).toBe("Filtres avancés (pièces), 1 actif");
    expect(filtresLabel(3)).toBe("Filtres avancés (pièces), 3 actifs");
  });
});
