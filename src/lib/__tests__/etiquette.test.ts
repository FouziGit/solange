import { describe, expect, it } from "vitest";
import {
  etatAchat,
  libelleLook,
  libellePiece,
  nPieces,
  niveauEtat,
  numeroPassage,
} from "../etiquette";
import { conditions } from "../taxonomie";
import { euro } from "../utils";

describe("niveauEtat", () => {
  it("suit l'ordre de taxonomie.conditions, du plus neuf au plus porté", () => {
    expect(conditions.map(niveauEtat)).toEqual([4, 3, 2, 1]);
  });

  it("ne donne aucun cran à un libellé inconnu", () => {
    expect(niveauEtat("")).toBe(0);
    expect(niveauEtat("Correct")).toBe(0);
  });

  it("ignore les espaces de bord", () => {
    expect(niveauEtat(" Bon état ")).toBe(1);
  });
});

describe("numeroPassage", () => {
  it("compte à partir de un, sur deux chiffres au moins", () => {
    expect(numeroPassage(0)).toBe("N°01");
    expect(numeroPassage(6)).toBe("N°07");
    expect(numeroPassage(99)).toBe("N°100");
  });
});

describe("nPieces", () => {
  it("accorde le mot", () => {
    expect(nPieces(1)).toBe("1 pièce");
    expect(nPieces(3)).toBe("3 pièces");
  });
});

describe("libellePiece", () => {
  it("dit la taille et le prix", () => {
    expect(libellePiece({ size: "43", priceEUR: 290 })).toBe(
      `Taille 43, ${euro(290)}`,
    );
  });

  it("sans prix, dit que la pièce est vendue", () => {
    expect(libellePiece({ size: "42" })).toBe("Taille 42, vendue");
  });
});

describe("libelleLook", () => {
  it("dit la position dans le fil", () => {
    expect(libelleLook(6)).toBe("Look numéro 7");
  });

  it("en bouton, reprend le texte affiché puis annonce les pièces à voir", () => {
    expect(libelleLook(6, 1)).toBe("N°07, 1 pièce : voir la pièce du look");
    expect(libelleLook(6, 3)).toBe("N°07, 3 pièces : voir les pièces du look");
  });
});

describe("etatAchat", () => {
  it("dit pourquoi la pièce ne s'achète pas, vendue d'abord", () => {
    expect(etatAchat({ sold: true, reserved: true, mine: true })).toBe(
      "Vendue",
    );
    expect(etatAchat({ sold: false, reserved: true, mine: true })).toBe(
      "Paiement en cours",
    );
    expect(etatAchat({ sold: false, mine: true })).toBe("Ta pièce");
  });

  it("ne dit rien d'une pièce achetable", () => {
    expect(etatAchat({ sold: false })).toBeNull();
    expect(etatAchat({ sold: false, reserved: false, mine: false })).toBeNull();
  });
});
