import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Les gardes de core.mts sont asynchrones. Oublier `await` ne se voit ni
   au typage ni au lint : `const blocked = assertCanWrite(user)` donne une
   Promise, toujours vraie, et `return blocked` renvoie null à Netlify
   (« Function returned an unsupported value »). C'est ce qui a cassé
   « Activer mes paiements » et, depuis a45cc61, TOUS les j'aime, suivis
   et blocages (social.mts) : l'écran les montrait, le serveur ne les
   enregistrait jamais. On relit donc le code de chaque fonction. */

const FUNCTIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const GUARDS = ["assertCanWrite", "currentUser", "rateLimit"];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(p);
    return p.endsWith(".mts") ? [p] : [];
  });
}

describe("gardes asynchrones des fonctions Netlify", () => {
  const files = sources(FUNCTIONS_DIR);

  it("trouve bien les fonctions à contrôler", () => {
    expect(files.some((f) => f.endsWith("social.mts"))).toBe(true);
    expect(files.some((f) => f.endsWith("stripe-connect.mts"))).toBe(true);
  });

  it.each(GUARDS)("chaque appel à %s est attendu (await)", (guard) => {
    const oublis = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(
          ({ line }) =>
            line.includes(`${guard}(`) &&
            !line.includes(`await ${guard}(`) &&
            !line.includes(`function ${guard}(`),
        )
        .map(({ n }) => `${path.relative(FUNCTIONS_DIR, f)}:${n}`),
    );
    expect(oublis).toEqual([]);
  });
});
