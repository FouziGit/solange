import { describe, expect, it } from "vitest";
import {
  parseInline,
  parseMarkdown,
  splitFrontmatter,
  stripComments,
} from "../markdown";

describe("splitFrontmatter", () => {
  it("lit les paires clé/valeur et rend le corps sans l'en-tête", () => {
    const { data, body } = splitFrontmatter(
      '---\ntitle: Mentions légales\nversion: 1.0\neffectiveDate: "[À COMPLÉTER]"\n---\n\n# Titre\n',
    );
    expect(data.title).toBe("Mentions légales");
    expect(data.version).toBe("1.0");
    expect(data.effectiveDate).toBe("[À COMPLÉTER]");
    expect(body.startsWith("# Titre")).toBe(true);
  });

  it("laisse le texte intact quand il n'y a pas d'en-tête", () => {
    const { data, body } = splitFrontmatter("# Titre\n");
    expect(data).toEqual({});
    expect(body).toBe("# Titre\n");
  });
});

describe("stripComments", () => {
  it("retire les réserves juridiques, qui ne sont pas pour le lecteur", () => {
    const out = stripComments("<!-- RÉSERVE — à faire valider -->\n\n# Titre");
    expect(out).not.toContain("RÉSERVE");
    expect(out).toContain("# Titre");
  });

  it("retire un commentaire multiligne", () => {
    expect(stripComments("a\n<!--\nligne 1\nligne 2\n-->\nb")).not.toContain(
      "ligne 1",
    );
  });
});

describe("parseInline", () => {
  it("reconnaît le gras, l'italique, le code et les liens", () => {
    expect(parseInline("un **gras** ici")).toEqual([
      { kind: "text", text: "un " },
      { kind: "strong", text: "gras" },
      { kind: "text", text: " ici" },
    ]);
    expect(parseInline("`sol_s`")).toEqual([{ kind: "code", text: "sol_s" }]);
    expect(parseInline("[les CGU](/cgu)")).toEqual([
      { kind: "link", text: "les CGU", href: "/cgu" },
    ]);
  });

  it("ne confond pas le gras avec deux italiques", () => {
    expect(parseInline("**paiements simulés**")).toEqual([
      { kind: "strong", text: "paiements simulés" },
    ]);
  });

  it("laisse le texte brut quand il n'y a aucune marque", () => {
    expect(parseInline("texte simple")).toEqual([
      { kind: "text", text: "texte simple" },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("lit les titres de niveau 1 à 3", () => {
    const b = parseMarkdown("# Un\n\n## Deux\n\n### Trois");
    expect(b.map((x) => x.kind === "heading" && x.level)).toEqual([1, 2, 3]);
  });

  it("recolle un paragraphe écrit sur plusieurs lignes", () => {
    const b = parseMarkdown("Une phrase\ncoupée en deux.");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ kind: "para" });
    if (b[0].kind === "para")
      expect(b[0].content[0]).toEqual({
        kind: "text",
        text: "Une phrase coupée en deux.",
      });
  });

  it("lit une liste à puces, continuations comprises", () => {
    const b = parseMarkdown("- premier\n- second qui\n  continue\n- troisième");
    expect(b[0]).toMatchObject({ kind: "list", ordered: false });
    if (b[0].kind === "list") {
      expect(b[0].items).toHaveLength(3);
      expect(b[0].items[1][0]).toEqual({
        kind: "text",
        text: "second qui continue",
      });
    }
  });

  it("distingue une liste numérotée", () => {
    const b = parseMarkdown("1. un\n2. deux");
    expect(b[0]).toMatchObject({ kind: "list", ordered: true });
  });

  it("lit un tableau avec son en-tête", () => {
    const b = parseMarkdown(
      "| Prix | Commission |\n|---|---|\n| moins de 200 € | 4 % |\n| 1 000 € et plus | 2 % |",
    );
    expect(b[0].kind).toBe("table");
    if (b[0].kind === "table") {
      expect(b[0].head).toHaveLength(2);
      expect(b[0].rows).toHaveLength(2);
      expect(b[0].rows[1][1][0]).toEqual({ kind: "text", text: "2 %" });
    }
  });

  it("lit une citation — l'article 12 des CGV en dépend", () => {
    const b = parseMarkdown(
      "> **Cet article n'est pas applicable.**\n> Suite.",
    );
    expect(b[0].kind).toBe("quote");
    if (b[0].kind === "quote") expect(b[0].blocks[0].kind).toBe("para");
  });

  it("ne rend jamais de HTML : la sortie est un arbre de données", () => {
    const b = parseMarkdown("<script>alert(1)</script>");
    expect(b[0].kind).toBe("para");
    if (b[0].kind === "para")
      expect(b[0].content[0]).toEqual({
        kind: "text",
        text: "<script>alert(1)</script>",
      });
  });
});
