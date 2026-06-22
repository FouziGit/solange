"use client";

import { AnimatePresence, motion } from "motion/react";
import { Chip } from "@/components/ui/Chip";
import type { SortKey } from "@/lib/data";
import { X } from "@/components/chrome/icons";

export type Filters = {
  priceMin: string;
  priceMax: string;
  sizes: string[];
  conds: string[];
  brands: string[];
  sort: SortKey;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Récent" },
  { key: "price-asc", label: "Prix ↑" },
  { key: "price-desc", label: "Prix ↓" },
  { key: "popular", label: "Populaire" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * Advanced-filter drawer for Découvrir.
 * Bottom-sheet on mobile, right glass panel on desktop. Strict noir & blanc.
 * Mirrors ShopTheLook's AnimatePresence / scrim / spring choreography.
 */
export function FilterDrawer({
  open,
  onOpenChange,
  value,
  onChange,
  sizes,
  conditions,
  brands,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Filters;
  onChange: (next: Filters) => void;
  sizes: string[];
  conditions: readonly string[];
  brands: string[];
  resultCount: number;
}) {
  const set = <K extends keyof Filters>(key: K, v: Filters[K]) =>
    onChange({ ...value, [key]: v });

  const reset = () =>
    onChange({
      priceMin: "",
      priceMax: "",
      sizes: [],
      conds: [],
      brands: [],
      sort: "recent",
    });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* panel: bottom-sheet on mobile, right rail on desktop */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Filtres avancés"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82%] flex-col overflow-hidden rounded-t-[28px] border-t border-bone/15 bg-coal/95 backdrop-blur-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-[28px] md:border-l md:border-t-0"
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 pb-2 pt-4 md:pt-12">
              <div>
                <p className="eyebrow text-sm text-bone">Affiner</p>
                <p className="font-display text-xl font-bold tracking-mega text-bone">
                  Filtres
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone"
                aria-label="Fermer les filtres"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mx-5 h-px bg-bone/10" />

            {/* controls */}
            <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
              {/* sort */}
              <fieldset>
                <legend className="overline mb-2.5 block text-[9px] text-ash">
                  Trier par
                </legend>
                <div className="grid grid-cols-4 gap-1.5">
                  {SORTS.map((s) => {
                    const on = value.sort === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => set("sort", s.key)}
                        aria-pressed={on}
                        data-cursor="link"
                        className={`rounded-full border py-1.5 text-[12px] font-medium transition-colors ${
                          on
                            ? "border-bone bg-bone text-ink"
                            : "border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* price */}
              <fieldset>
                <legend className="overline mb-2.5 block text-[9px] text-ash">
                  Prix (€)
                </legend>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={value.priceMin}
                    onChange={(e) => set("priceMin", e.target.value)}
                    placeholder="Min"
                    aria-label="Prix minimum en euros"
                    className="field"
                  />
                  <span className="text-ash">—</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={value.priceMax}
                    onChange={(e) => set("priceMax", e.target.value)}
                    placeholder="Max"
                    aria-label="Prix maximum en euros"
                    className="field"
                  />
                </div>
              </fieldset>

              {/* sizes */}
              <fieldset>
                <legend className="overline mb-2.5 block text-[9px] text-ash">
                  Tailles
                </legend>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <Chip
                      key={s}
                      active={value.sizes.includes(s)}
                      onClick={() => set("sizes", toggle(value.sizes, s))}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              {/* conditions */}
              <fieldset>
                <legend className="overline mb-2.5 block text-[9px] text-ash">
                  État
                </legend>
                <div className="flex flex-wrap gap-2">
                  {conditions.map((c) => (
                    <Chip
                      key={c}
                      active={value.conds.includes(c)}
                      onClick={() => set("conds", toggle(value.conds, c))}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              {/* brands */}
              <fieldset>
                <legend className="overline mb-2.5 block text-[9px] text-ash">
                  Marques
                </legend>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <Chip
                      key={b}
                      active={value.brands.includes(b)}
                      onClick={() => set("brands", toggle(value.brands, b))}
                    >
                      {b}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* footer actions */}
            <div className="flex items-center justify-between gap-3 border-t border-bone/10 px-5 pb-safe pt-4">
              <button
                onClick={reset}
                className="text-xs text-ash transition-colors hover:text-bone"
              >
                Réinitialiser
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full bg-bone px-5 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95"
              >
                Voir {resultCount} pièce{resultCount > 1 ? "s" : ""}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
