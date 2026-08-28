"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ProductCard,
  sortMemberProducts,
  toDisplayItem,
} from "@/components/ui/ProductCard";
import { Chip } from "@/components/ui/Chip";
import { FilterDrawer, type Filters } from "@/components/ui/FilterDrawer";
import { Avatar } from "@/components/chrome/Avatar";
import { categories, conditions, trendingTags } from "@/lib/mock";
import {
  catalogBrands,
  catalogSizes,
  filterCatalog,
  searchAll,
} from "@/lib/data";
import { useStore } from "@/lib/store";
import { cn, compact, euro, gradientFor } from "@/lib/utils";
import { imgLook } from "@/lib/img";
import { Photo } from "@/components/ui/Photo";
import { Search, Sliders, Verified } from "@/components/chrome/icons";

const EMPTY_FILTERS: Filters = {
  priceMin: "",
  priceMax: "",
  sizes: [],
  conds: [],
  brands: [],
  sort: "recent",
};

type Dimension = "pieces" | "profils" | "contenu";

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "pieces", label: "Pièces" },
  { key: "profils", label: "Profils" },
  { key: "contenu", label: "Contenu" },
];

function DecouvrirInner() {
  // ?q= lets the feed's quiet "pièces similaires" bridge land pre-filtered
  const params = useSearchParams();
  const [cat, setCat] = useState<string>("Tout");
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [tab, setTab] = useState<Dimension>("pieces");
  const [focused, setFocused] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { isFollowing, toggleFollow, serverProducts } = useStore();

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

  // Annonces membres (backend) : mêmes filtres que le catalogue, disponibles
  // d'abord, injectées EN TÊTE de la grille Pièces.
  const memberItems = useMemo(() => {
    const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
    const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
    const qn = q.trim().toLowerCase();
    return sortMemberProducts(serverProducts)
      .filter((p) => {
        if (cat !== "Tout" && p.category !== cat) return false;
        if (qn) {
          const hay = `${p.brand} ${p.name} ${p.category}`.toLowerCase();
          if (!hay.includes(qn)) return false;
        }
        if (filters.sizes.length && !filters.sizes.includes(p.size))
          return false;
        if (filters.conds.length && !filters.conds.includes(p.condition))
          return false;
        if (filters.brands.length && !filters.brands.includes(p.brand))
          return false;
        if (priceMax != null && p.priceEUR > priceMax) return false;
        if (priceMin != null && p.priceEUR < priceMin) return false;
        return true;
      })
      .map(toDisplayItem);
  }, [serverProducts, cat, q, filters]);

  const allItems = useMemo(
    () => [...memberItems, ...items],
    [memberItems, items],
  );

  const hasQuery = q.trim().length > 0;
  const results = useMemo(() => searchAll(q), [q]);

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

  const counts: Record<Dimension, number | null> = {
    pieces: allItems.length,
    profils: hasQuery ? results.profiles.length : null,
    contenu: hasQuery ? results.content.length : null,
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Marketplace"
        title="Découvrir"
        subtitle="Le moteur de recherche de la mode de seconde main. Pièces, profils, contenus — filtre, chine, achète."
        right={
          <span className="hidden text-sm text-ash md:block">
            {allItems.length} pièces
          </span>
        }
      />

      {/* search */}
      <div className="glass flex items-center gap-3 rounded-full px-4 py-3">
        <Search className="size-5 shrink-0 text-ash" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Rechercher une marque, un profil, un contenu…"
          aria-label="Rechercher dans SOLANGE"
          className="w-full bg-transparent text-sm text-bone outline-none placeholder:text-ash"
        />
        <button
          onClick={() => setDrawer(true)}
          className="relative grid size-8 shrink-0 place-items-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone/20"
          aria-label="Filtres avancés (pièces)"
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

      {/* suggestions — visible while the field is focused & empty */}
      {focused && !hasQuery && (
        <div
          className="mt-3 border border-bone/15 p-4"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="overline mb-2 text-[9px] text-ash">Tendances</p>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((t) => (
              <Chip key={t} onClick={() => setQ(t.replace("#", ""))}>
                {t}
              </Chip>
            ))}
          </div>
          <p className="overline mb-2 mt-4 text-[9px] text-ash">Marques</p>
          <div className="flex flex-wrap gap-2">
            {brands.slice(0, 8).map((b) => (
              <Chip key={b} onClick={() => setQ(b)}>
                {b}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* dimension tabs */}
      <div
        role="tablist"
        aria-label="Dimensions de recherche"
        className="mt-4 grid grid-cols-3 border border-bone/20"
      >
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            id={`tab-${d.key}`}
            aria-selected={tab === d.key}
            aria-controls={`panel-${d.key}`}
            data-cursor="link"
            onClick={() => setTab(d.key)}
            className={cn(
              "min-h-11 whitespace-nowrap px-2 py-2.5 text-[13px] font-medium transition-colors",
              tab === d.key
                ? "bg-bone text-ink"
                : "text-bone/70 hover:text-bone",
            )}
          >
            {d.label}
            {counts[d.key] != null && (
              <span
                className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  tab === d.key ? "text-ink/60" : "text-ash",
                )}
              >
                {counts[d.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ————— Pièces ————— */}
      <div
        role="tabpanel"
        id="panel-pieces"
        aria-labelledby="tab-pieces"
        hidden={tab !== "pieces"}
      >
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

        {/* masonry grid — annonces membres en tête, puis catalogue */}
        {allItems.length > 0 ? (
          <div className="mt-7 columns-2 gap-3 md:columns-3 xl:columns-4">
            {allItems.map((it, i) => (
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
                Aucune pièce ne correspond. Élargis tes filtres ou tente une
                autre marque.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ————— Profils ————— */}
      <div
        role="tabpanel"
        id="panel-profils"
        aria-labelledby="tab-profils"
        hidden={tab !== "profils"}
      >
        {!hasQuery ? (
          <p className="mt-16 text-center text-sm text-ash">
            Cherche un nom ou un handle pour trouver des profils.
          </p>
        ) : results.profiles.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ash">
            Aucun profil ne correspond à «&nbsp;{q.trim()}&nbsp;».
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-bone/10 border border-bone/15">
            {results.profiles.map((c) => {
              const followed = isFollowing(c.handle);
              return (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <Link
                    href="/profil"
                    data-cursor="link"
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar
                      name={c.name}
                      seed={c.seed}
                      className="size-11 shrink-0 text-lg"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-sm font-semibold text-bone">
                          {c.name}
                        </span>
                        {c.verified && (
                          <Verified className="size-3.5 shrink-0 text-bone" />
                        )}
                      </span>
                      <span className="block truncate text-[12px] text-ash">
                        @{c.handle} · {compact(c.followers)} abonnés
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    data-cursor="link"
                    onClick={() => toggleFollow(c.handle)}
                    aria-pressed={followed}
                    className={cn(
                      "min-h-11 shrink-0 border px-4 text-[12px] font-semibold transition-colors",
                      followed
                        ? "border-bone/25 text-bone/70 hover:border-bone/40"
                        : "border-bone bg-bone text-ink hover:bg-bone/90",
                    )}
                  >
                    {followed ? "Suivi" : "Suivre"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ————— Contenu ————— */}
      <div
        role="tabpanel"
        id="panel-contenu"
        aria-labelledby="tab-contenu"
        hidden={tab !== "contenu"}
      >
        {!hasQuery ? (
          <p className="mt-16 text-center text-sm text-ash">
            Cherche une marque, un style ou un sujet pour trouver des posts et
            des articles.
          </p>
        ) : results.content.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ash">
            Aucun contenu ne correspond à «&nbsp;{q.trim()}&nbsp;».
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-bone/10 border border-bone/15">
            {results.content.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <Link
                  href={hit.type === "post" ? "/" : `/journal/${hit.id}`}
                  data-cursor="link"
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-bone/[0.04]"
                >
                  <span
                    className="relative block size-12 shrink-0 overflow-hidden"
                    style={{ background: gradientFor(hit.seed) }}
                    aria-hidden="true"
                  >
                    {hit.type === "post" && (
                      <Photo src={imgLook(hit.id)} alt="" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="overline block text-[9px] text-ash">
                      {hit.type === "post" ? "Post" : "Journal"}
                    </span>
                    <span className="block truncate text-sm font-semibold text-bone">
                      {hit.title}
                    </span>
                    <span className="block truncate text-[12px] text-ash">
                      {hit.sub}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FilterDrawer
        open={drawer}
        onOpenChange={setDrawer}
        value={filters}
        onChange={setFilters}
        sizes={sizes}
        conditions={conditions}
        brands={brands}
        resultCount={allItems.length}
      />
    </PageShell>
  );
}

/** useSearchParams needs a Suspense boundary for static prerender. */
export default function DecouvrirPage() {
  return (
    <Suspense fallback={null}>
      <DecouvrirInner />
    </Suspense>
  );
}
