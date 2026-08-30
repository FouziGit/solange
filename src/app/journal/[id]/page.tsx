import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  articles,
  catalogItem,
  looks,
  type Article,
  type CatalogItem,
} from "@/lib/mock";
import { imgItem } from "@/lib/img";
import { PageShell } from "@/components/ui/PageShell";
import { LuxeMedia } from "@/components/ui/LuxeMedia";
import { ProductCard } from "@/components/ui/ProductCard";
import { Avatar } from "@/components/chrome/Avatar";
import { ArrowLeft, ChevronRight } from "@/components/chrome/icons";

/** Rubrique labels — kind → French kicker. */
const KIND_LABEL: Record<Article["kind"], string> = {
  focus: "Focus",
  collection: "Collection",
  entretien: "Entretien",
};

/** Editorial folio: index 0 → "Nº 01". */
function folio(index: number): string {
  return `Nº ${String(index + 1).padStart(2, "0")}`;
}

/** "2026-07-08" → "8 juillet 2026" (UTC, deterministic). */
function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Pre-render a static spread for every article. */
export function generateStaticParams() {
  return articles.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = articles.find((a) => a.id === id);
  if (!article) return { title: "Journal" };
  return {
    title: `${article.title} — Journal`,
    description: article.standfirst.slice(0, 160),
  };
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const index = articles.findIndex((a) => a.id === id);
  if (index === -1) notFound();
  const article = articles[index];

  const pieces = article.productIds
    .map((pid) => catalogItem(pid))
    .filter((it): it is CatalogItem => it !== undefined);

  const creator = article.creatorHandle
    ? looks.find((l) => l.creator.handle === article.creatorHandle)?.creator
    : undefined;

  const [lede, ...body] = article.paragraphs;

  return (
    <PageShell marginWord="Journal">
      {/* back to the sommaire */}
      <Link
        href="/journal"
        data-cursor="link"
        aria-label="Retour au Journal"
        className="glass mb-8 inline-grid size-11 place-items-center text-bone transition-transform active:scale-90"
      >
        <ArrowLeft className="size-5" />
      </Link>

      {/* ---------- Spread header ---------- */}
      <header className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between border-t border-bone/25 pt-3">
          <span className="overline text-[11px] text-bone/70">
            {KIND_LABEL[article.kind]}
            {article.brand ? ` — ${article.brand}` : ""}
          </span>
          <span className="overline text-[11px] text-bone/40">
            Journal · {folio(index)}
          </span>
        </div>

        <h1 className="font-editorial mt-6 text-[clamp(2.4rem,9vw,5.25rem)] font-semibold leading-[0.95] tracking-tight text-bone">
          {article.title}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-bone/70 md:text-lg">
          {article.standfirst}
        </p>

        <div className="mt-6 flex items-center gap-3 border-b border-bone/15 pb-4">
          <span className="overline text-[11px] text-bone/55">
            {article.readingMin} min de lecture
          </span>
          <span className="overline text-[11px] text-bone/55">
            {frDate(article.date)}
          </span>
        </div>
      </header>

      {/* ---------- Hero media ---------- */}
      <figure className="mx-auto mt-8 max-w-4xl">
        <div className="relative aspect-[4/5] overflow-hidden ring-1 ring-bone/20 md:aspect-[21/10]">
          <LuxeMedia
            seed={article.seed}
            image={
              article.productIds[0] ? imgItem(article.productIds[0]) : undefined
            }
            brand={article.brand}
            watermark={false}
            eager
          />
        </div>
        <figcaption className="mt-2 flex items-center justify-between">
          <span className="text-[12px] text-bone/40">
            {article.brand ?? KIND_LABEL[article.kind]} — Archive Solange
          </span>
          <span className="overline text-[11px] text-bone/30">
            {folio(index)}
          </span>
        </figcaption>
      </figure>

      {/* ---------- Body ---------- */}
      <div className="mx-auto mt-10 max-w-prose md:mt-14">
        {lede && (
          <p className="font-editorial text-xl leading-snug text-bone md:text-2xl">
            {lede}
          </p>
        )}
        {body.length > 0 && (
          <div className="mt-8 space-y-6 border-t border-bone/15 pt-8">
            {body.map((p, i) => (
              <p key={i} className="text-[15px] leading-[1.85] text-bone/80">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Pièces citées — marketplace bridge ---------- */}
      {pieces.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl">
          <div className="flex items-baseline justify-between border-t border-bone/20 pt-3">
            <h2 className="eyebrow text-sm text-bone/55">Pièces citées</h2>
            <span className="overline text-[11px] text-bone/40">
              {pieces.length} pièce{pieces.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {pieces.map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Creator bridge — social ---------- */}
      {creator && (
        <section className="mx-auto mt-10 max-w-4xl">
          <Link
            href="/profil"
            data-cursor="link"
            aria-label={`Voir le profil de ${creator.name}`}
            className="glass flex min-h-[44px] items-center gap-4 px-4 py-3 transition-transform active:scale-[0.99]"
          >
            <Avatar
              name={creator.name}
              seed={creator.seed}
              className="size-11 shrink-0 text-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-bone">
                {creator.name}
              </p>
              <p className="mt-0.5 text-[12px] text-bone/50">
                @{creator.handle}
              </p>
            </div>
            <span className="overline hidden text-[11px] text-bone/55 md:inline">
              Voir le profil
            </span>
            <ChevronRight className="size-4 shrink-0 text-bone/60" />
          </Link>
        </section>
      )}

      {/* closing folio */}
      <div className="mt-14 flex items-center justify-center gap-4 border-t border-bone/15 pt-6">
        <span className="overline text-[11px] text-bone/35">
          {folio(index)} — Journal Solange
        </span>
      </div>
    </PageShell>
  );
}
