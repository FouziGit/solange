import { notFound } from "next/navigation";
import { catalog, catalogItem } from "@/lib/mock";
import { similarTo } from "@/lib/data";
import { euro } from "@/lib/utils";
import { PageShell } from "@/components/ui/PageShell";
import { ArrowLeft } from "@/components/chrome/icons";
import Link from "next/link";
import { ArticleDetail } from "./ArticleDetail";

/** Pre-render a static page for every catalog tile. */
export function generateStaticParams() {
  return catalog.map((it) => ({ id: it.id }));
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = catalogItem(id);
  if (!item) notFound();

  const similar = similarTo(item);

  return (
    <PageShell marginWord="Marché">
      <Link
        href="/decouvrir"
        data-cursor="link"
        aria-label="Retour"
        className="glass mb-6 inline-grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <ArticleDetail item={item} similar={similar} />
      {/* SSR-visible price for crawlers even before island hydrates */}
      <span className="sr-only">
        {item.brand} {item.name} — {euro(item.priceEUR)}
      </span>
    </PageShell>
  );
}
