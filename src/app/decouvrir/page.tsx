"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductCard } from "@/components/ui/ProductCard";
import { Chip } from "@/components/ui/Chip";
import { FilterDrawer, type Filters } from "@/components/ui/FilterDrawer";
import { categories, conditions, trendingTags } from "@/lib/mock";
import { catalogBrands, catalogSizes, filterCatalog } from "@/lib/data";
import { euro } from "@/lib/utils";
import { Search, Sliders } from "@/components/chrome/icons";

const EMPTY_FILTERS: Filters = {
  priceMin: "",
  priceMax: "",
  sizes: [],
  conds: [],
  brands: [],
  sort: "recent",
};

export default function DecouvrirPage() {
  const [cat, setCat] = useState<string>("Tout");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const sizes = useMemo(() => catalogSizes(), []);
  const brands = useMemo(() => catalogBrands(), []);

  const items = useMemo(() => {
    const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
    const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
    const out = filterCatalog({
      category: cat,
      query: q,
      sizes: filters.sizes,
      conds: filters.conds,
      brands: filters.brands,
      priceMax,
      sort: filters.sort,
    });
    // priceMin isn't a filterCatalog field — apply locally to keep SSOT intact.
    return priceMin != null ? out.filter((it) => it.priceEUR >= priceMin) : out;
  }, [cat, q, filters]);

  const priceMinNum = filters.priceMin ? Number(filters.priceMin) : undefined;
  const priceMaxNum = filters.priceMax ? Number(filters.priceMax) : undefined;
  const invertedRange =
    priceMinNum != null && priceMaxNum != null && priceMinNum > priceMaxNum;

  const activeCount =
    (filters.priceMin ? 1 : 0) +
    (filters.priceMax ? 1 : 0) +
    filters.sizes.length +
    filters.conds.length +
    filters.brands.length +
    (filters.sort !== "recent" ? 1 : 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Marketplace"
        title="Découvrir"
        subtitle="Le moteur de recherche de la mode de seconde main. Marques, styles, archives — filtre, chine, achète."
        right={
          <span className="hidden text-sm text-ash md:block">
            {items.length} pièces
          </span>
        }
      />

      {/* search */}
      <div className="glass flex items-center gap-3 rounded-full px-4 py-3">
        <Search className="size-5 shrink-0 text-ash" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une marque, un style, une pièce…"
          aria-label="Rechercher dans le catalogue"
          className="w-full bg-transparent text-sm text-bone outline-none placeholder:text-ash"
        />
        <button
          onClick={() => setDrawer(true)}
          className="relative grid size-8 shrink-0 place-items-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone/20"
          aria-label="Filtres avancés"
          aria-haspopup="dialog"
          aria-expanded={drawer}
        >
          <Sliders className="size-4" />
          {activeCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-bone text-[9px] font-bold text-ink"
              aria-hidden="true"
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* categories */}
      <div
        role="tablist"
        aria-label="Catégories"
        className="hscroll -mx-5 mt-4 flex gap-2 px-5 pb-1 md:mx-0 md:px-0"
      >
        {categories.map((c) => (
          <span key={c} role="tab" aria-selected={c === cat}>
            <Chip active={c === cat} onClick={() => setCat(c)}>
              {c}
            </Chip>
          </span>
        ))}
      </div>

      {/* trending */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="overline text-[9px] text-ash">Tendances</span>
        {trendingTags.map((t) => (
          <button
            key={t}
            onClick={() => setQ(t.replace("#", ""))}
            className="text-[12px] text-ash transition-colors hover:text-bone"
          >
            {t}
          </button>
        ))}
      </div>

      {/* masonry grid */}
      {items.length > 0 ? (
        <div className="mt-7 columns-2 gap-3 md:columns-3 xl:columns-4">
          {items.map((it, i) => (
            <ProductCard key={it.id} item={it} index={i} />
          ))}
        </div>
      ) : (
        <div className="mt-20 text-center">
          {invertedRange ? (
            <p className="mx-auto max-w-xs text-sm text-ash">
              Ton prix minimum ({euro(priceMinNum!)}) dépasse ton maximum (
              {euro(priceMaxNum!)}). Inverse les deux bornes pour voir des
              pièces.
            </p>
          ) : (
            <p className="mx-auto max-w-xs text-sm text-ash">
              Aucune pièce ne correspond. Élargis tes filtres ou tente une autre
              marque.
            </p>
          )}
        </div>
      )}

      <FilterDrawer
        open={drawer}
        onOpenChange={setDrawer}
        value={filters}
        onChange={setFilters}
        sizes={sizes}
        conditions={conditions}
        brands={brands}
        resultCount={items.length}
      />
    </PageShell>
  );
}
