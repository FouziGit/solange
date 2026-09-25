import { describe, expect, it } from "vitest";
import {
  filterConversations,
  isOpenConversation,
  searchResultsLabel,
  speakerPrefix,
} from "../conversation-search";

/* Jeu d'essai propre au test : le catalogue de démonstration est vide. */
const convs = [
  { id: "a", name: "Élodie R", handle: "elodie.r" },
  { id: "b", name: "@marc · acheteur", handle: "marc" },
  { id: "c", name: "Nouh B", handle: "nouhb" },
];
const ids = (q: string) => filterConversations(convs, q).map((c) => c.id);

describe("filterConversations — la recherche filtre vraiment la liste", () => {
  it("saisie vide ou blanche : liste inchangée, même référence", () => {
    expect(filterConversations(convs, "")).toBe(convs);
    expect(filterConversations(convs, "   ")).toBe(convs);
  });

  it("trouve par nom affiché, sans tenir compte de la casse ni des accents", () => {
    expect(ids("elodie")).toEqual(["a"]);
    expect(ids("ÉLO")).toEqual(["a"]);
    expect(ids("nouh")).toEqual(["c"]);
  });

  it("trouve par @handle, avec ou sans « @ »", () => {
    expect(ids("nouhb")).toEqual(["c"]);
    expect(ids("@nouhb")).toEqual(["c"]);
    expect(ids("@marc")).toEqual(["b"]);
  });

  it("côté vendeur, le libellé « acheteur » du fil est cherchable", () => {
    expect(ids("acheteur")).toEqual(["b"]);
  });

  it("espaces multiples ramenés à un seul", () => {
    expect(ids("  nouh    b ")).toEqual(["c"]);
  });

  it("aucun résultat : liste vide", () => {
    expect(ids("zzz")).toEqual([]);
  });

  it("ne modifie pas la liste reçue", () => {
    const copy = [...convs];
    filterConversations(convs, "nouh");
    expect(convs).toEqual(copy);
  });
});

describe("searchResultsLabel — nombre de résultats annoncé", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(searchResultsLabel(0)).toBe("Aucune conversation trouvée");
    expect(searchResultsLabel(1)).toBe("1 conversation trouvée");
    expect(searchResultsLabel(4)).toBe("4 conversations trouvées");
  });
});

describe("speakerPrefix — qui parle dans une bulle", () => {
  it("mes messages : « Toi : », comme l'aperçu de la liste", () => {
    expect(speakerPrefix("me", "nouhb")).toBe("Toi : ");
  });

  it("messages de l'autre : son @handle", () => {
    expect(speakerPrefix("them", "nouhb")).toBe("@nouhb : ");
  });
});

describe("isOpenConversation — aria-current de la liste", () => {
  it("aucune conversation ouverte : aucune n'est « actuelle »", () => {
    for (const c of convs) expect(isOpenConversation(c.id, null)).toBe(false);
  });

  it("seul le fil ouvert est « actuel »", () => {
    expect(isOpenConversation("b", "b")).toBe(true);
    expect(isOpenConversation("a", "b")).toBe(false);
  });
});
