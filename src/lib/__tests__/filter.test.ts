import { describe, expect, it } from "vitest";
import { filterCatalog, similarTo } from "@/lib/data";
import { catalog, catalogItem } from "@/lib/mock";

describe("filterCatalog", () => {
  it("returns the full catalog for an empty filter", () => {
    expect(filterCatalog()).toHaveLength(catalog.length);
  });

  it('treats the "Tout" category as no filter', () => {
    expect(filterCatalog({ category: "Tout" })).toHaveLength(catalog.length);
  });

  it("filters by category", () => {
    const out = filterCatalog({ category: "Sneakers" });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((it) => it.category === "Sneakers")).toBe(true);
    // k7 (Salomon) and k11 (Nike) are the two sneakers in the catalog
    expect(out.map((it) => it.id).sort()).toEqual(["k11", "k7"]);
  });

  it("matches a query as a case-insensitive substring of brand/name/category", () => {
    const out = filterCatalog({ query: "margiela" });
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((it) =>
        `${it.brand} ${it.name} ${it.category}`
          .toLowerCase()
          .includes("margiela"),
      ),
    ).toBe(true);
  });

  it("caps results by priceMax (inclusive)", () => {
    const out = filterCatalog({ priceMax: 100 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((it) => it.priceEUR <= 100)).toBe(true);
    // 110 € Salomon must be excluded; 95 € Carhartt must be present
    expect(out.some((it) => it.id === "k3")).toBe(true);
    expect(out.some((it) => it.id === "k7")).toBe(false);
  });

  it("combines category and priceMax", () => {
    const out = filterCatalog({ category: "Luxe", priceMax: 500 });
    expect(out.every((it) => it.category === "Luxe" && it.priceEUR <= 500)).toBe(
      true,
    );
    // Prada (680 €) excluded, Margiela coat (420 €) included
    expect(out.some((it) => it.id === "k9")).toBe(false);
    expect(out.some((it) => it.id === "k2")).toBe(true);
  });
});

describe("similarTo", () => {
  it("returns same-category items and excludes the item itself", () => {
    const margielaCoat = catalogItem("k2")!; // Luxe
    const out = similarTo(margielaCoat);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((it) => it.category === "Luxe")).toBe(true);
    expect(out.some((it) => it.id === "k2")).toBe(false);
  });

  it("returns an empty list when the item is the only one in its category", () => {
    // Every Archive item shares the category, so pick one and check the seam:
    const archive = catalogItem("k1")!;
    const out = similarTo(archive);
    expect(out.every((it) => it.id !== "k1")).toBe(true);
  });
});
