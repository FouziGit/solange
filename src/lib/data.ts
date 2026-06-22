/* ============================================================
   SOLANGE — data selectors (the backend seam)
   These are SYNC functions over the in-memory mock arrays today.
   When a real backend lands, each becomes an async repository call
   (e.g. filterCatalog -> GET /catalog?…, liked -> GET /me/favoris)
   with the SAME signature, so callers don't change.
   ============================================================ */

import {
  catalog,
  catalogItem,
  savedItems,
  type CatalogItem,
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
  return catalog.slice(0, 8);
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
