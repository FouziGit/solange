import { describe, expect, it } from "vitest";
import { filtresLabel, marquesEnVente, resultatsMarche } from "../marche";

describe("resultatsMarche", () => {
  it("compte les pièces, au singulier comme au pluriel", () => {
    expect(resultatsMarche({ pieces: 1 })).toBe("1 pièce");
    expect(resultatsMarche({ pieces: 12 })).toBe("12 pièces");
  });

  it("ajoute membres et looks quand une recherche est en cours", () => {
    expect(resultatsMarche({ pieces: 12, profiles: 3, content: 1 })).toBe(
      "12 pièces, 3 membres, 1 look",
    );
    expect(resultatsMarche({ pieces: 2, profiles: 0, content: 0 })).toBe(
      "2 pièces, 0 membre, 0 look",
    );
  });

  it("dit clairement qu'il n'y a aucune pièce", () => {
    expect(resultatsMarche({ pieces: 0 })).toBe("Aucune pièce ne correspond");
    expect(resultatsMarche({ pieces: 0, profiles: 2, content: 0 })).toBe(
      "Aucune pièce ne correspond. 2 membres, 0 look",
    );
  });

  it("donne la cause quand les bornes de prix sont inversées", () => {
    expect(resultatsMarche({ pieces: 0, invertedRange: true })).toBe(
      "Aucune pièce : ton prix minimum dépasse ton maximum",
    );
  });
});

describe("marquesEnVente", () => {
  it("dédoublonne et trie en français", () => {
    expect(
      marquesEnVente([
        { brand: "Prada" },
        { brand: "Études" },
        { brand: "Dior", status: "available" },
        { brand: "Prada", status: "available" },
      ]),
    ).toEqual(["Dior", "Études", "Prada"]);
  });

  it("ignore les marques vides", () => {
    expect(marquesEnVente([{ brand: "" }, { brand: "  " }])).toEqual([]);
  });

  it("ignore les pièces qui ne sont plus en vente", () => {
    expect(
      marquesEnVente([
        { brand: "Chanel", status: "sold" },
        { brand: "Celine", status: "reserved" },
        { brand: "Fendi", status: "withdrawn" },
        { brand: "Dior", status: "available" },
        // une pièce de démonstration n'a pas de statut : elle est en vente
        { brand: "Gucci" },
      ]),
    ).toEqual(["Dior", "Gucci"]);
  });

  it("garde une marque dont une pièce reste en vente", () => {
    expect(
      marquesEnVente([
        { brand: "Chanel", status: "sold" },
        { brand: "Chanel", status: "available" },
      ]),
    ).toEqual(["Chanel"]);
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
