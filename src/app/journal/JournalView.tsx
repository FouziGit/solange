"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Article } from "@/lib/mock";
import { imgItem } from "@/lib/img";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxeMedia } from "@/components/ui/LuxeMedia";

/** Rubrique labels — kind → French overline. */
const KIND_LABEL: Record<Article["kind"], string> = {
  focus: "Focus",
  collection: "Collection",
  entretien: "Entretien",
};

/** Editorial folio: index 0 → "Nº 01". */
export function folio(index: number): string {
  return `Nº ${String(index + 1).padStart(2, "0")}`;
}

/** "2026-07-08" → "8 juillet 2026" (UTC, deterministic SSR/CSR). */
export function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function JournalView({ articles }: { articles: Article[] }) {
  const [cover, ...rest] = articles;

  return (
    <PageShell marginWord="Journal">
      <PageHeader
        eyebrow="Éditorial"
        title="Journal"
        subtitle="Le magazine de la seconde main. Maisons d'archive, vestiaires construits pour durer et entretiens avec celles et ceux qui chinent."
        sectionNo={folio(0)}
      />

      {/* ---------- Cover story ---------- */}
      {cover && (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <Link
            href={`/journal/${cover.id}`}
            data-cursor="link"
            aria-label={`${KIND_LABEL[cover.kind]} — ${cover.title}`}
            className="group block"
          >
            <article className="relative aspect-[4/5] overflow-hidden ring-1 ring-bone/20 md:aspect-[2/1]">
              <LuxeMedia
                seed={cover.seed}
                image={
                  cover.productIds[0] ? imgItem(cover.productIds[0]) : undefined
                }
                brand={cover.brand}
                watermark={false}
                eager
                className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
              />

              {/* kicker row — top hairline, rubrique + folio */}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-bone/15 px-5 py-3 md:px-8">
                <span className="overline text-[11px] text-bone/80">
                  {KIND_LABEL[cover.kind]}
                </span>
                <span className="overline text-[11px] text-bone/50">
                  {folio(0)} — À la une
                </span>
              </div>

              {/* headline block */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 md:p-8">
                <h2 className="font-editorial max-w-4xl text-[clamp(2.1rem,8vw,4.75rem)] font-semibold leading-[0.95] tracking-tight text-bone">
                  {cover.title}
                </h2>
                <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-bone/75 md:text-[15px]">
                  {cover.standfirst}
                </p>
                <div className="mt-1 flex items-center gap-3 border-t border-bone/20 pt-3">
                  <span className="overline text-[11px] text-bone/60">
                    {cover.readingMin} min de lecture
                  </span>
                  <span aria-hidden="true" className="h-px w-6 bg-bone/25" />
                  <span className="overline text-[11px] text-bone/60">
                    {frDate(cover.date)}
                  </span>
                  {cover.brand && (
                    <>
                      <span
                        aria-hidden="true"
                        className="hidden h-px w-6 bg-bone/25 md:block"
                      />
                      <span className="overline hidden text-[11px] text-bone/60 md:inline">
                        {cover.brand}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </article>
          </Link>
        </motion.section>
      )}

      {/* ---------- Sommaire — remaining articles ---------- */}
      {rest.length > 0 && (
        <section className="mt-12 md:mt-16">
          <div className="flex items-baseline justify-between border-t border-bone/20 pt-3">
            <h2 className="eyebrow text-sm text-bone/55">Au sommaire</h2>
            <span className="overline text-[11px] text-bone/40">
              {rest.length} article{rest.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((a, i) => (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                  delay: Math.min(i * 0.06, 0.3),
                }}
              >
                <Link
                  href={`/journal/${a.id}`}
                  data-cursor="link"
                  aria-label={`${KIND_LABEL[a.kind]} — ${a.title}`}
                  className="group block"
                >
                  {/* thin top rule + rubrique + folio */}
                  <div className="flex items-baseline justify-between border-t border-bone/25 pt-3">
                    <span className="overline text-[11px] text-bone/60">
                      {KIND_LABEL[a.kind]}
                    </span>
                    <span className="overline text-[11px] text-bone/35">
                      {folio(i + 1)}
                    </span>
                  </div>

                  <div className="relative mt-4 aspect-[4/3] overflow-hidden ring-1 ring-bone/15">
                    <LuxeMedia
                      seed={a.seed}
                      image={
                        a.productIds[0] ? imgItem(a.productIds[0]) : undefined
                      }
                      brand={a.brand}
                      watermark={false}
                      className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                    />
                  </div>

                  <h3 className="font-editorial mt-4 text-2xl font-semibold leading-[1.05] tracking-tight text-bone md:text-[1.65rem]">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ash">
                    {a.standfirst}
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    {a.brand && (
                      <span className="overline border border-bone/20 px-2 py-1 text-[11px] text-bone/70">
                        {a.brand}
                      </span>
                    )}
                    <span className="overline text-[11px] text-bone/45">
                      {a.readingMin} min · {frDate(a.date)}
                    </span>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {/* closing folio */}
      <div className="mt-14 flex items-center justify-center gap-4 border-t border-bone/15 pt-6">
        <span aria-hidden="true" className="h-px w-10 bg-bone/20" />
        <span className="overline text-[11px] text-bone/35">
          Journal — Solange Éditions
        </span>
        <span aria-hidden="true" className="h-px w-10 bg-bone/20" />
      </div>
    </PageShell>
  );
}
