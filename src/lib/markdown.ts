/* ============================================================
   SOLANGE — micro-analyseur Markdown pour les documents légaux.
   Volontairement limité au sous-ensemble employé dans legal/*.md :
   titres, paragraphes, listes, tableaux, citations, filets, et en
   ligne : gras, italique, code, liens.

   Pourquoi pas une dépendance : sept fichiers de texte que nous
   écrivons nous-mêmes ne justifient pas d'ajouter un analyseur
   généraliste (et sa surface de sécurité) au bundle. Le code de push
   a suivi le même raisonnement. L'entrée n'est JAMAIS du contenu
   membre : uniquement des fichiers du dépôt.

   Rien ici ne produit de HTML brut : la sortie est un arbre que React
   rend en éléments, donc aucune injection possible par construction.
   ============================================================ */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { kind: "para"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "rule" };

export type Frontmatter = Record<string, string>;

/** Sépare l'en-tête YAML simple du corps. Pas d'analyseur YAML : nos
    en-têtes sont des paires « clé: valeur » sur une ligne. */
export function splitFrontmatter(src: string): {
  data: Frontmatter;
  body: string;
} {
  const normalized = src.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: normalized };
  const head = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n+/, "");
  const data: Frontmatter = {};
  for (const line of head.split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return { data, body };
}

/** Retire les commentaires HTML — c'est là que vivent les réserves
    juridiques, destinées au dépôt et jamais au lecteur. */
export function stripComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, "");
}

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\n]+)\*)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  for (;;) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) break;
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ kind: "strong", text: m[2] });
    else if (m[4] !== undefined) out.push({ kind: "code", text: m[4] });
    else if (m[6] !== undefined)
      out.push({ kind: "link", text: m[6], href: m[7] });
    else if (m[9] !== undefined) out.push({ kind: "em", text: m[9] });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ kind: "text", text: rest });
  return out.length ? out : [{ kind: "text", text: "" }];
}

function tableCells(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isSeparator = (line: string) =>
  /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

export function parseMarkdown(src: string): Block[] {
  const lines = stripComments(src).replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // filet
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    // titre
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({
        kind: "heading",
        level: h[1].length as 1 | 2 | 3,
        content: parseInline(h[2].trim()),
      });
      i++;
      continue;
    }

    // citation
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", blocks: parseMarkdown(buf.join("\n")) });
      continue;
    }

    // tableau : ligne d'en-tête suivie d'une ligne de séparation
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isSeparator(lines[i + 1])
    ) {
      const head = tableCells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(tableCells(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    // listes — une entrée peut se poursuivre sur les lignes suivantes
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items: Inline[][] = [];
      let current = (bullet ?? numbered)![1];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) break;
        const nextBullet = /^\s*[-*]\s+(.*)$/.exec(l);
        const nextNumbered = /^\s*\d+\.\s+(.*)$/.exec(l);
        if (ordered ? nextNumbered : nextBullet) {
          items.push(parseInline(current.trim()));
          current = (nextNumbered ?? nextBullet)![1];
        } else if (nextBullet || nextNumbered) {
          break; // changement de type de liste
        } else {
          current += " " + l.trim(); // continuation
        }
        i++;
      }
      items.push(parseInline(current.trim()));
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // paragraphe
    const buf: string[] = [line.trim()];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (
        !l.trim() ||
        /^(#{1,3})\s/.test(l) ||
        /^\s*[-*]\s+/.test(l) ||
        /^\s*\d+\.\s+/.test(l) ||
        /^\s*>/.test(l) ||
        (l.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1]))
      )
        break;
      buf.push(l.trim());
      i++;
    }
    blocks.push({ kind: "para", content: parseInline(buf.join(" ")) });
  }

  return blocks;
}
