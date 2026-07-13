/* ============================================================
   SOLANGE — data selectors (the backend seam)
   These are SYNC functions over the in-memory mock arrays today.
   When a real backend lands, each becomes an async repository call
   (e.g. filterCatalog -> GET /catalog?…, liked -> GET /me/favoris)
   with the SAME signature, so callers don't change.
   ============================================================ */

import {
  articles,
  catalog,
  catalogItem,
  looks,
  me,
  savedItems,
  streams,
  type CatalogItem,
  type Creator,
} from "@/lib/mock";

export type SortKey = "recent" | "price-asc" | "price-desc" | "popular";

export type CatalogFilter = {
  category?: string;
  query?: string;
  sizes?: string[];
  conds?: string[];
  priceMax?: number;
  brands?: string[];
  sort?: SortKey;
};

/**
 * Filter + sort the catalog. Every field is optional; an empty filter
 * returns the full catalog in source order ("recent").
 */
export function filterCatalog(opts: CatalogFilter = {}): CatalogItem[] {
  const { category, query, sizes, conds, priceMax, brands, sort } = opts;
  const q = query?.trim().toLowerCase() ?? "";

  const out = catalog.filter((it) => {
    if (category && category !== "Tout" && it.category !== category)
      return false;
    if (q) {
      const hay = `${it.brand} ${it.name} ${it.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (sizes?.length && !sizes.includes(it.size)) return false;
    if (conds?.length && !conds.includes(it.condition)) return false;
    if (priceMax != null && it.priceEUR > priceMax) return false;
    if (brands?.length && !brands.includes(it.brand)) return false;
    return true;
  });

  switch (sort) {
    case "price-asc":
      return [...out].sort((a, b) => a.priceEUR - b.priceEUR);
    case "price-desc":
      return [...out].sort((a, b) => b.priceEUR - a.priceEUR);
    case "popular":
      return [...out].sort((a, b) => b.likes - a.likes);
    case "recent":
    default:
      return out;
  }
}

/** Pieces the current user has listed for sale (vitrine). */
export function forSale(): CatalogItem[] {
  return catalog.filter((it) => it.seller === me.handle);
}

/** Pieces the current user has saved (favoris). */
export function liked(): CatalogItem[] {
  return savedItems;
}

/** Lookup a single catalog tile by id. */
export function getCatalogItem(id: string): CatalogItem | undefined {
  return catalogItem(id);
}

/** Other pieces in the same category (excluding the item itself). */
export function similarTo(item: CatalogItem): CatalogItem[] {
  return catalog.filter(
    (it) => it.category === item.category && it.id !== item.id,
  );
}

/** Unique brands present in the catalog, alphabetically sorted. */
export function catalogBrands(): string[] {
  return [...new Set(catalog.map((it) => it.brand))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

/** Unique sizes present in the catalog, sorted. */
export function catalogSizes(): string[] {
  return [...new Set(catalog.map((it) => it.size))].sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true }),
  );
}

/** One search-result row for posts & articles (recherche unifiée). */
export type ContentHit = {
  type: "post" | "article";
  id: string;
  title: string;
  sub: string;
  seed: string;
};

/** Every creator visible in the app (feed + lives), deduped by id. */
function allCreators(): Creator[] {
  const seen = new Map<string, Creator>();
  for (const c of [
    ...looks.map((l) => l.creator),
    ...streams.map((s) => s.creator),
  ]) {
    if (!seen.has(c.id)) seen.set(c.id, c);
  }
  return [...seen.values()];
}

/**
 * Recherche unifiée : pièces (catalogue), profils (créateurs) et
 * contenus (posts du feed + articles éditoriaux). Case-insensitive
 * substring match. Empty query returns empty arrays.
 */
export function searchAll(q: string): {
  items: CatalogItem[];
  profiles: Creator[];
  content: ContentHit[];
} {
  const needle = q.trim().toLowerCase();
  if (!needle) return { items: [], profiles: [], content: [] };

  const items = filterCatalog({ query: needle });

  const profiles = allCreators().filter((c) =>
    `${c.name} ${c.handle}`.toLowerCase().includes(needle),
  );

  const postHits: ContentHit[] = looks
    .filter((l) =>
      [l.title, l.caption, ...l.tags, ...(l.brandTags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    )
    .map((l) => ({
      type: "post" as const,
      id: l.id,
      title: l.title,
      sub: l.caption,
      seed: l.seed,
    }));

  const articleHits: ContentHit[] = articles
    .filter((a) =>
      `${a.title} ${a.standfirst} ${a.brand ?? ""}`
        .toLowerCase()
        .includes(needle),
    )
    .map((a) => ({
      type: "article" as const,
      id: a.id,
      title: a.title,
      sub: a.standfirst,
      seed: a.seed,
    }));

  return { items, profiles, content: [...postHits, ...articleHits] };
}
