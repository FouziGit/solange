import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Garde-fou a11y de globals.css : on lit le vrai fichier, on en tire les
   tokens de chaque thème et on refait le calcul de contraste WCAG. Pas de
   DOM : un mini-parseur à accolades suffit pour ce fichier. */

const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

type Block = {
  prelude: string;
  decls: Map<string, string>;
  children: Block[];
  parent: Block | null;
};

function parse(src: string): Block {
  const root: Block = {
    prelude: "",
    decls: new Map(),
    children: [],
    parent: null,
  };
  let current = root;
  let buf = "";
  let quote: string | null = null;
  const flush = () => {
    const text = buf.trim();
    buf = "";
    const colon = text.indexOf(":");
    if (!text || text.startsWith("@") || colon < 0) return;
    current.decls.set(
      text.slice(0, colon).trim(),
      text
        .slice(colon + 1)
        .trim()
        .replace(/\s+/g, " "),
    );
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
    } else if (ch === "/" && src[i + 1] === "*") {
      // commentaire, hors chaîne : `@source not "../../*.md"` n'en est pas un
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 1;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
    } else if (ch === "{") {
      const block: Block = {
        prelude: buf.trim().replace(/\s+/g, " "),
        decls: new Map(),
        children: [],
        parent: current,
      };
      buf = "";
      current.children.push(block);
      current = block;
    } else if (ch === "}") {
      flush();
      current = current.parent ?? root;
    } else if (ch === ";") {
      flush();
    } else {
      buf += ch;
    }
  }
  return root;
}

const ROOT = parse(CSS);

/** Premier bloc qui suit exactement ce chemin de préludes. */
function find(from: Block, path: string[]): Block | undefined {
  if (path.length === 0) return from;
  for (const child of from.children) {
    if (child.prelude !== path[0]) continue;
    const hit = find(child, path.slice(1));
    if (hit) return hit;
  }
  return undefined;
}

function walk(from: Block, visit: (b: Block) => void) {
  for (const child of from.children) {
    visit(child);
    walk(child, visit);
  }
}

function ancestors(b: Block): string[] {
  const out: string[] = [];
  for (let p = b.parent; p && p !== ROOT; p = p.parent) out.push(p.prelude);
  return out;
}

const MEDIA_LIGHT = "@media (prefers-color-scheme: light)";
const MEDIA_MORE = "@media (prefers-contrast: more)";
const MEDIA_MORE_LIGHT =
  "@media (prefers-contrast: more) and (prefers-color-scheme: light)";

const TOKEN_BLOCKS = {
  dark: [":root"],
  light: [MEDIA_LIGHT, ":root"],
  themeDark: [".theme-dark"],
  moreDark: [MEDIA_MORE, ":root"],
  moreLight: [MEDIA_MORE_LIGHT, ":root"],
  moreThemeDark: [MEDIA_MORE, ".theme-dark"],
};

/* Bloc absent : map vide, et le test « blocs de thème » dit lequel. */
const tokens = (path: string[]) =>
  find(ROOT, path)?.decls ?? new Map<string, string>();

const dark = tokens(TOKEN_BLOCKS.dark);
const light = tokens(TOKEN_BLOCKS.light);
const themeDark = tokens(TOKEN_BLOCKS.themeDark);
const moreDark = tokens(TOKEN_BLOCKS.moreDark);
const moreLight = tokens(TOKEN_BLOCKS.moreLight);
const moreThemeDark = tokens(TOKEN_BLOCKS.moreThemeDark);

/* Même ordre que la cascade sur <html> : chaque couche écrase la précédente. */
const merge = (...layers: Map<string, string>[]) =>
  new Map(layers.flatMap((l) => [...l]));

const THEMES: Record<string, Map<string, string>> = {
  sombre: merge(dark),
  clair: merge(dark, light),
  "feed .theme-dark (OS clair)": merge(dark, light, themeDark),
  "contraste renforcé, sombre": merge(dark, moreDark),
  "contraste renforcé, clair": merge(dark, light, moreDark, moreLight),
  "contraste renforcé, .theme-dark": merge(
    dark,
    light,
    themeDark,
    moreDark,
    moreLight,
    moreThemeDark,
  ),
};

type RGBA = { r: number; g: number; b: number; a: number };

function color(value: string | undefined): RGBA {
  if (!value) throw new Error("token absent");
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = "1"] = fn[1].split(/[\s,/]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  }
  throw new Error(`couleur non gérée : ${value}`);
}

const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };

/** fg posé sur bg opaque, fg pris à `alpha` (défaut : son propre alpha). */
function over(fg: RGBA, bg: RGBA, alpha = fg.a): RGBA {
  const mix = (f: number, b: number) => f * alpha + b * (1 - alpha);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

function luminance({ r, g, b }: RGBA): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* Opacité réelle de la tab bar, lue dans .glass-bar. */
const glassBar = find(ROOT, [".glass-bar"])?.decls.get("background") ?? "";
const BAR_OPACITY = Number(glassBar.match(/var\(--background\) (\d+)%/)?.[1]);

/** Fonds sur lesquels du texte est posé, pour un thème donné. */
function surfaces(t: Map<string, string>): [string, RGBA][] {
  const bone = color(t.get("--c-bone"));
  const noir = color(t.get("--c-noir"));
  const coal = color(t.get("--c-coal"));
  const bg = color(t.get("--background"));
  return [
    ["ink", color(t.get("--c-ink"))],
    ["noir", noir],
    ["coal", coal],
    ["--background", bg],
    // cartes et puces teintées les plus claires : bg-bone/[0.06], bg-bone/10
    ["bone/[0.06] sur noir", over(bone, noir, 0.06)],
    ["bone/10 sur noir", over(bone, noir, 0.1)],
    ["bone/[0.06] sur coal", over(bone, coal, 0.06)],
    ["bone/10 sur coal", over(bone, coal, 0.1)],
    // tab bar translucide : pire cas, contenu noir ou blanc qui défile dessous
    ["tab bar sur contenu noir", over(bg, BLACK, BAR_OPACITY / 100)],
    ["tab bar sur contenu blanc", over(bg, WHITE, BAR_OPACITY / 100)],
  ];
}

describe("globals.css — contrastes des tokens (WCAG 1.4.3 / 1.4.11)", () => {
  it("chaque bloc de thème existe (clair, sombre, .theme-dark, contraste renforcé)", () => {
    for (const path of Object.values(TOKEN_BLOCKS)) {
      expect(find(ROOT, path), path.join(" > ")).toBeDefined();
    }
  });

  it("la tab bar a une opacité lisible dans .glass-bar", () => {
    expect(BAR_OPACITY).toBeGreaterThan(0);
    expect(BAR_OPACITY).toBeLessThanOrEqual(100);
  });

  for (const [name, t] of Object.entries(THEMES)) {
    describe(name, () => {
      it("texte principal (bone) ≥ 4.5:1 sur chaque fond", () => {
        const bone = color(t.get("--c-bone"));
        for (const [label, bg] of surfaces(t)) {
          expect(contrast(bone, bg), label).toBeGreaterThanOrEqual(4.5);
        }
        expect(
          contrast(color(t.get("--foreground")), color(t.get("--background"))),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it("texte secondaire (ash) ≥ 4.5:1 sur chaque fond", () => {
        const ash = color(t.get("--c-ash"));
        for (const [label, bg] of surfaces(t)) {
          expect(contrast(ash, bg), label).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("contour de champ ≥ 3:1, dehors comme dedans", () => {
        const border = color(t.get("--field-border"));
        const fieldBg = color(t.get("--field-bg"));
        for (const key of ["--c-ink", "--c-noir", "--c-coal"]) {
          const page = color(t.get(key));
          const inside = over(fieldBg, page);
          const edge = over(border, inside);
          expect(contrast(edge, page), `${key} dehors`).toBeGreaterThanOrEqual(
            3,
          );
          expect(
            contrast(edge, inside),
            `${key} dedans`,
          ).toBeGreaterThanOrEqual(3);
        }
      });

      it("le contour au focus est plus marqué qu'au repos", () => {
        expect(color(t.get("--field-border-focus")).a).toBeGreaterThan(
          color(t.get("--field-border")).a,
        );
      });
    });
  }

  it(".theme-dark reprend exactement les valeurs sombres de :root", () => {
    for (const [key, value] of themeDark) {
      expect(value, key).toBe(dark.get(key));
    }
    for (const [key, value] of moreThemeDark) {
      expect(value, key).toBe(moreDark.get(key));
    }
  });

  it("contraste renforcé : ash ≥ 7:1 et filets, verre, champs renforcés", () => {
    const pairs: [Map<string, string>, Map<string, string>][] = [
      [THEMES["sombre"], THEMES["contraste renforcé, sombre"]],
      [THEMES["clair"], THEMES["contraste renforcé, clair"]],
      [
        THEMES["feed .theme-dark (OS clair)"],
        THEMES["contraste renforcé, .theme-dark"],
      ],
    ];
    for (const [base, more] of pairs) {
      const ash = color(more.get("--c-ash"));
      for (const key of ["--c-ink", "--c-noir", "--c-coal"]) {
        expect(contrast(ash, color(more.get(key))), key).toBeGreaterThanOrEqual(
          7,
        );
      }
      for (const key of ["--hairline", "--glass-border"]) {
        expect(color(more.get(key)).a, key).toBeGreaterThanOrEqual(0.35);
      }
      for (const key of ["--glass-bg", "--field-border"]) {
        expect(color(more.get(key)).a, key).toBeGreaterThan(
          color(base.get(key)).a,
        );
      }
    }
  });
});

function px(size: string | undefined): number {
  const m = size?.match(/^([\d.]+)(rem|px)$/);
  if (!m) throw new Error(`taille non gérée : ${size}`);
  return m[2] === "rem" ? +m[1] * 16 : +m[1];
}

function minWidth(b: Block): number {
  for (const prelude of ancestors(b)) {
    const m = prelude.match(/min-width:\s*(\d+)px/);
    if (m) return +m[1];
  }
  return 0;
}

describe("globals.css — champs .field", () => {
  const fieldBlocks: Block[] = [];
  walk(ROOT, (b) => {
    if (/\.field\b/.test(b.prelude)) fieldBlocks.push(b);
  });

  it("toutes les règles .field sont dans @layer components", () => {
    expect(fieldBlocks.length).toBeGreaterThan(0);
    for (const b of fieldBlocks) {
      expect(ancestors(b), b.prelude).toContain("@layer components");
    }
  });

  it("le texte des champs fait au moins 16px sous 768px (pas de zoom iOS)", () => {
    const sized = fieldBlocks.filter(
      (b) => b.prelude === ".field" && b.decls.has("font-size"),
    );
    const mobile = sized.filter((b) => minWidth(b) < 768);
    expect(mobile.length).toBeGreaterThan(0);
    for (const b of mobile) {
      expect(px(b.decls.get("font-size"))).toBeGreaterThanOrEqual(16);
    }
  });

  it("aucune règle .field ne supprime l'anneau de focus", () => {
    for (const b of fieldBlocks) {
      expect(b.decls.get("outline") ?? "", b.prelude).not.toMatch(
        /^(none|0)\b/,
      );
    }
  });

  it("l'anneau :focus-visible global reste hors couche", () => {
    const ring = find(ROOT, [":focus-visible"]);
    expect(ring?.decls.get("outline")).toMatch(/solid/);
  });
});

describe("globals.css — défilement et mouvement", () => {
  it("html garde l'élément focalisé au-dessus de la tab bar", () => {
    expect(find(ROOT, ["html"])?.decls.get("scroll-padding-bottom")).toBe(
      "var(--tabbar-clearance)",
    );
  });

  it("Réduire les animations coupe aussi .animate-ping", () => {
    const media = find(ROOT, ["@media (prefers-reduced-motion: reduce)"]);
    const rule = media?.children.find((b) =>
      b.prelude.split(",").some((s) => s.trim() === ".animate-ping"),
    );
    expect(rule?.decls.get("animation")).toBe("none !important");
  });

  it(".page-enter ne laisse aucun transform une fois finie (fixed = écran)", () => {
    // `both` / `forwards` garderaient translateY(0) : le wrapper de page
    // deviendrait le bloc conteneur de chaque élément `fixed` (toasts…)
    const animation = find(ROOT, [".page-enter"])?.decls.get("animation");
    expect(animation).toMatch(/\bbackwards\b/);
    expect(animation).not.toMatch(/\b(both|forwards)\b/);
  });
});
