import { describe, expect, it } from "vitest";
import {
  PALIERS,
  destinataires,
  doitRelancer,
  palierAtteint,
  texteRelance,
} from "../fomo";

describe("palierAtteint", () => {
  it("ne retient rien sous le premier palier — un j'aime ne dit rien", () => {
    expect(palierAtteint(0)).toBe(0);
    expect(palierAtteint(1)).toBe(0);
    expect(palierAtteint(2)).toBe(0);
  });

  it("retient le palier franchi, pas le suivant", () => {
    expect(palierAtteint(3)).toBe(3);
    expect(palierAtteint(9)).toBe(3);
    expect(palierAtteint(10)).toBe(10);
    expect(palierAtteint(24)).toBe(10);
    expect(palierAtteint(999)).toBe(100);
  });
});

describe("doitRelancer — une relance par palier, jamais deux", () => {
  it("relance au franchissement", () => {
    expect(doitRelancer(3, 0)).toBe(true);
    expect(doitRelancer(10, 3)).toBe(true);
  });

  it("ne relance PAS deux fois le même palier", () => {
    expect(doitRelancer(3, 3)).toBe(false);
    expect(doitRelancer(9, 3)).toBe(false);
  });

  it("ne relance pas sous le premier palier", () => {
    expect(doitRelancer(2, 0)).toBe(false);
  });

  it("ne relance pas si les j'aime redescendent", () => {
    expect(doitRelancer(4, 10)).toBe(false);
  });

  it("une pièce qui monte d'un coup ne déclenche qu'UNE relance", () => {
    // 0 → 60 j'aime : un seul palier retenu, pas quatre notifications
    expect(palierAtteint(60)).toBe(50);
    expect(doitRelancer(60, 0)).toBe(true);
    expect(doitRelancer(60, 50)).toBe(false);
  });

  it("le nombre total de relances possibles dans la vie d'une pièce est borné", () => {
    expect(PALIERS.length).toBeLessThanOrEqual(5);
  });
});

describe("texteRelance — le chiffre vrai, rien d'autre", () => {
  it("porte le nombre réel de j'aime", () => {
    expect(texteRelance("Celine", "Veste", 10)).toBe(
      "Celine Veste plaît : 10 personnes l'ont aimée.",
    );
  });

  it("n'invente aucune urgence", () => {
    const t = texteRelance("Nike", "Air Max", 25);
    for (const interdit of [
      "vite",
      "dépêche",
      "bientôt",
      "plus que",
      "dernière chance",
      "regardent",
    ]) {
      expect(t.toLowerCase()).not.toContain(interdit);
    }
  });

  it("reste lisible quand la marque manque", () => {
    expect(texteRelance("", "Veste", 3)).toBe(
      "Veste plaît : 3 personnes l'ont aimée.",
    );
  });
});

describe("destinataires", () => {
  const gardeurs = new Map([["p1", ["u_a", "u_b", "u_vendeur"]]]);

  it("prévient celles et ceux qui ont gardé la pièce", () => {
    expect(destinataires(gardeurs, "p1", null)).toEqual([
      "u_a",
      "u_b",
      "u_vendeur",
    ]);
  });

  it("ne relance jamais quelqu'un sur sa propre annonce", () => {
    expect(destinataires(gardeurs, "p1", "u_vendeur")).toEqual(["u_a", "u_b"]);
  });

  it("rend une liste vide pour une pièce que personne n'a gardée", () => {
    expect(destinataires(gardeurs, "p2", null)).toEqual([]);
  });
});
