import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import {
  parseMarkdown,
  splitFrontmatter,
  type Block,
  type Inline,
} from "@/lib/markdown";
import { LEGAL_DOCS, legalDoc } from "@/lib/legal";
import { PageShell } from "@/components/ui/PageShell";

/* ============================================================
   SOLANGE — affichage d'un document légal.
   Le texte est lu depuis legal/<slug>.md AU MOMENT DU RENDU côté
   serveur (composant serveur, page statique) : une seule source, pas
   de copie qui divergerait (D-033). Les commentaires de réserve du
   fichier source sont retirés par l'analyseur — ils s'adressent au
   dépôt, jamais au lecteur.
   ============================================================ */

function Text({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.kind === "strong")
          return (
            <strong key={i} className="font-semibold text-bone">
              {n.text}
            </strong>
          );
        if (n.kind === "em")
          return (
            <em key={i} className="italic">
              {n.text}
            </em>
          );
        if (n.kind === "code")
          return (
            <code
              key={i}
              className="break-all rounded bg-bone/8 px-1 py-0.5 font-mono text-[0.9em] text-bone/90"
            >
              {n.text}
            </code>
          );
        if (n.kind === "link") {
          const external = /^https?:/.test(n.href);
          const cls =
            "text-bone underline underline-offset-4 transition-colors hover:text-bone/70";
          return external ? (
            <a
              key={i}
              href={n.href}
              target="_blank"
              rel="noreferrer noopener"
              className={cls}
            >
              {n.text}
            </a>
          ) : (
            <Link key={i} href={n.href} className={cls} data-cursor="link">
              {n.text}
            </Link>
          );
        }
        return <span key={i}>{n.text}</span>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            if (b.level === 1) return null; // le titre est déjà en tête de page
            return b.level === 2 ? (
              <h2
                key={i}
                className="mt-10 font-display text-[19px] font-bold tracking-tight text-bone md:text-[21px]"
              >
                <Text nodes={b.content} />
              </h2>
            ) : (
              <h3 key={i} className="mt-7 text-[15px] font-semibold text-bone">
                <Text nodes={b.content} />
              </h3>
            );
          case "para":
            return (
              <p key={i} className="mt-3.5">
                <Text nodes={b.content} />
              </p>
            );
          case "list": {
            const cls = "mt-3.5 flex flex-col gap-2 pl-5";
            const items = b.items.map((it, j) => (
              <li key={j} className="marker:text-ash">
                <Text nodes={it} />
              </li>
            ));
            return b.ordered ? (
              <ol key={i} className={`${cls} list-decimal`}>
                {items}
              </ol>
            ) : (
              <ul key={i} className={`${cls} list-disc`}>
                {items}
              </ul>
            );
          }
          case "table":
            return (
              /* les tableaux (barème de commission, durées, sanctions)
                 débordent sur mobile : ils défilent dans leur propre
                 cadre, la page ne défile jamais horizontalement */
              <div key={i} className="mt-5 -mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[30rem] border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th
                          key={j}
                          className="border-b border-bone/20 px-3 py-2 text-left font-semibold text-bone"
                        >
                          <Text nodes={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td
                            key={k}
                            className="border-b border-bone/8 px-3 py-2 align-top"
                          >
                            <Text nodes={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="mt-5 border-l-2 border-bone/30 bg-bone/[0.03] py-1 pl-4 pr-3"
              >
                <Blocks blocks={b.blocks} />
              </blockquote>
            );
          case "rule":
            return <hr key={i} className="mt-8 border-bone/10" />;
        }
      })}
    </>
  );
}

export async function loadLegal(slug: string) {
  const raw = await readFile(
    path.join(process.cwd(), "legal", `${slug}.md`),
    "utf8",
  );
  const { data, body } = splitFrontmatter(raw);
  return { data, blocks: parseMarkdown(body) };
}

export async function LegalDocument({ slug }: { slug: string }) {
  const doc = legalDoc(slug);
  if (!doc) return null;
  const { data, blocks } = await loadLegal(slug);

  return (
    <PageShell marginWord="Légal">
      <article className="mx-auto w-full max-w-2xl">
        <Link
          href="/informations-legales"
          data-cursor="link"
          className="etiquette inline-flex min-h-11 items-center text-[11px] text-ash transition-colors hover:text-bone"
        >
          ← Informations légales
        </Link>

        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
          {doc.title}
        </h1>
        {data.version && (
          <p className="mt-2 text-[12px] text-ash">
            Version {data.version}
            {data.effectiveDate
              ? ` · en vigueur depuis le ${data.effectiveDate}`
              : ""}
          </p>
        )}

        <div className="mt-8 text-[14px] leading-relaxed text-bone/85">
          <Blocks blocks={blocks} />
        </div>

        <nav className="mt-14 border-t border-bone/10 pt-6">
          <p className="etiquette text-[11px] text-ash">Les autres documents</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_DOCS.filter((d) => d.slug !== slug).map((d) => (
              <li key={d.slug}>
                <Link
                  href={d.href}
                  data-cursor="link"
                  className="inline-flex min-h-11 items-center text-[13px] text-bone/70 underline underline-offset-4 transition-colors hover:text-bone"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </PageShell>
  );
}
