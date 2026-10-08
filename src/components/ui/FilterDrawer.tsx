"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Check, Search } from "@/components/chrome/icons";
import { cn } from "@/lib/utils";
import type { SortKey } from "@/lib/data";

export type Filters = {
  /** catégories allumées ; toutes ou aucune = pas de filtre */
  cats: string[];
  priceMin: string;
  priceMax: string;
  sizes: string[];
  conds: string[];
  brands: string[];
  sort: SortKey;
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Récent" },
  { key: "popular", label: "Populaire" },
  { key: "price-asc", label: "Prix croissant" },
  { key: "price-desc", label: "Prix décroissant" },
];

type Section = "tri" | "cats" | "marques" | "tailles" | "etat" | "prix";

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

const cle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** « Dior, Chanel +2 » — le résumé tient sur une ligne. */
function resume(list: string[], vide: string, max = 2) {
  if (list.length === 0) return vide;
  const head = list.slice(0, max).join(", ");
  return list.length > max ? `${head} +${list.length - max}` : head;
}

/**
 * Tiroir Filtres du Marché — le seul endroit où l'on affine.
 * Sections dépliables, chacune résume son choix sur sa ligne : on voit
 * tout ce qui est actif sans rien ouvrir. Bottom-sheet sur mobile,
 * panneau droit sur desktop. Strict noir & blanc.
 */
export function FilterDrawer({
  open,
  onOpenChange,
  value,
  onChange,
  categories,
  clothingSizes,
  shoeSizes,
  conditions,
  featuredBrands,
  allBrands,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Filters;
  onChange: (next: Filters) => void;
  categories: string[];
  clothingSizes: readonly string[];
  shoeSizes: readonly string[];
  conditions: readonly string[];
  featuredBrands: string[];
  allBrands: string[];
  resultCount: number;
}) {
  const [openSec, setOpenSec] = useState<Section | null>("cats");
  const [brandQ, setBrandQ] = useState("");

  const set = <K extends keyof Filters>(key: K, v: Filters[K]) =>
    onChange({ ...value, [key]: v });

  const reset = () =>
    onChange({
      cats: categories,
      priceMin: "",
      priceMax: "",
      sizes: [],
      conds: [],
      brands: [],
      sort: "recent",
    });

  const allCats = value.cats.length === categories.length;
  const noCat = value.cats.length === 0;

  const brandList = useMemo(() => {
    const k = cle(brandQ.trim());
    if (!k) {
      // les maisons choisies hors des phares restent visibles en tête
      const extra = value.brands.filter((b) => !featuredBrands.includes(b));
      return [...extra, ...featuredBrands];
    }
    return [...new Set([...featuredBrands, ...allBrands])].filter((b) =>
      cle(b).includes(k),
    );
  }, [brandQ, featuredBrands, allBrands, value.brands]);

  const clothes = value.sizes.filter((s) => clothingSizes.includes(s));
  const shoes = value.sizes.filter((s) => shoeSizes.includes(s));
  const price =
    value.priceMin && value.priceMax
      ? `${value.priceMin} – ${value.priceMax} €`
      : value.priceMin
        ? `dès ${value.priceMin} €`
        : value.priceMax
          ? `jusqu'à ${value.priceMax} €`
          : "Tous les prix";

  const sec = (key: Section) => ({
    open: openSec === key,
    onToggle: () => setOpenSec((s) => (s === key ? null : key)),
  });

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      eyebrow="Affiner"
      title="Filtres"
      ariaLabel="Filtres du Marché"
      desktopSide
      maxHeight="90%"
    >
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        <Row
          label="Trier par"
          summary={SORTS.find((s) => s.key === value.sort)?.label ?? ""}
          {...sec("tri")}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {SORTS.map((s) => (
              <Pill
                key={s.key}
                on={value.sort === s.key}
                onClick={() => set("sort", s.key)}
              >
                {s.label}
              </Pill>
            ))}
          </div>
        </Row>

        <Row
          label="Catégories"
          summary={
            allCats || noCat ? "Toutes" : resume(value.cats, "Toutes", 3)
          }
          active={!allCats && !noCat}
          {...sec("cats")}
        >
          <div className="flex flex-wrap gap-1.5">
            <Pill
              on={allCats}
              onClick={() => set("cats", allCats ? [] : categories)}
            >
              Tout
            </Pill>
            {categories.map((c) => (
              <Pill
                key={c}
                on={value.cats.includes(c)}
                onClick={() => set("cats", toggle(value.cats, c))}
              >
                {c}
              </Pill>
            ))}
          </div>
        </Row>

        <Row
          label="Marques"
          summary={resume(value.brands, "Toutes")}
          active={value.brands.length > 0}
          {...sec("marques")}
        >
          <div className="flex items-center gap-3 border border-bone/15 px-3.5 py-2.5 focus-within:border-bone/40">
            <Search className="size-4 shrink-0 text-ash" />
            <input
              value={brandQ}
              onChange={(e) => setBrandQ(e.target.value)}
              placeholder="Chercher une maison…"
              aria-label="Chercher une marque"
              className="w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-sm"
            />
          </div>
          <ul
            aria-label="Marques"
            className="mt-2 grid grid-cols-2 gap-x-4"
          >
            {brandList.length === 0 ? (
              <li className="col-span-full py-6 text-center text-[12.5px] text-ash">
                Aucune maison ne s&apos;appelle ainsi.
              </li>
            ) : (
              brandList.map((b) => {
                const on = value.brands.includes(b);
                return (
                  <li key={b}>
                    <button
                      type="button"
                      aria-pressed={on}
                      data-cursor="link"
                      onClick={() => set("brands", toggle(value.brands, b))}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-2 py-1.5 text-left text-[13.5px] leading-snug transition-colors",
                        on ? "text-bone" : "text-bone/65 hover:text-bone",
                      )}
                    >
                      <span>{b}</span>
                      <Tick on={on} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Row>

        <Row
          label="Tailles"
          summary={resume([...clothes, ...shoes], "Toutes", 4)}
          active={value.sizes.length > 0}
          {...sec("tailles")}
        >
          <p className="etiquette mb-2 text-[10.5px] text-ash">Vêtements</p>
          <div className="grid grid-cols-7 gap-1">
            {clothingSizes.map((s) => (
              <Square
                key={s}
                on={value.sizes.includes(s)}
                onClick={() => set("sizes", toggle(value.sizes, s))}
              >
                {s}
              </Square>
            ))}
          </div>
          <p className="etiquette mb-2 mt-5 text-[10.5px] text-ash">
            Chaussures
          </p>
          <div className="grid grid-cols-8 gap-1">
            {shoeSizes.map((s) => (
              <Square
                key={s}
                on={value.sizes.includes(s)}
                onClick={() => set("sizes", toggle(value.sizes, s))}
              >
                {s}
              </Square>
            ))}
          </div>
        </Row>

        <Row
          label="État"
          summary={resume(value.conds, "Tous", 1)}
          active={value.conds.length > 0}
          {...sec("etat")}
        >
          <div className="flex flex-col">
            {conditions.map((c) => {
              const on = value.conds.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  data-cursor="link"
                  onClick={() => set("conds", toggle(value.conds, c))}
                  className={cn(
                    "flex min-h-11 items-center justify-between text-left text-[13.5px] transition-colors",
                    on ? "text-bone" : "text-bone/65 hover:text-bone",
                  )}
                >
                  {c}
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        </Row>

        <Row
          label="Prix"
          summary={price}
          active={!!(value.priceMin || value.priceMax)}
          {...sec("prix")}
        >
          <div className="flex items-center gap-3">
            <PriceField
              label="Prix minimum en euros"
              placeholder="Min"
              value={value.priceMin}
              onChange={(v) => set("priceMin", v)}
            />
            <span className="text-ash">—</span>
            <PriceField
              label="Prix maximum en euros"
              placeholder="Max"
              value={value.priceMax}
              onChange={(v) => set("priceMax", v)}
            />
          </div>
        </Row>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-bone/10 px-5 pb-safe pt-3.5">
        <Button variant="ghost" size="sm" onClick={reset}>
          Tout effacer
        </Button>
        <Button onClick={() => onOpenChange(false)}>
          Voir {resultCount} pièce{resultCount > 1 ? "s" : ""}
        </Button>
      </div>
    </Sheet>
  );
}

/** Une section dépliable : libellé, résumé du choix, chevron. */
function Row({
  label,
  summary,
  active = false,
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className="border-b border-bone/10">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        data-cursor="link"
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 text-left"
      >
        <span className="text-[15px] font-medium text-bone">{label}</span>
        <span
          className={cn(
            "ml-auto truncate text-[12.5px]",
            active ? "text-bone" : "text-ash",
          )}
        >
          {active && (
            <span
              aria-hidden
              className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-bone align-middle"
            />
          )}
          {summary}
        </span>
        <motion.svg
          aria-hidden
          viewBox="0 0 12 12"
          className="size-3 shrink-0 text-ash"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <path
            d="M2 4.5 6 8l4-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-cursor="link"
      onClick={onClick}
      className={cn(
        "min-h-11 border px-4 text-[13px] font-medium transition-colors",
        on
          ? "border-bone bg-bone text-ink"
          : "border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}

/** Case de taille / pointure : carrée, compacte, alignée en grille. */
function Square({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-cursor="link"
      onClick={onClick}
      className={cn(
        "grid min-h-11 place-items-center border text-[12.5px] font-medium tabular-nums transition-colors",
        on
          ? "border-bone bg-bone text-ink"
          : "border-bone/15 text-bone/70 hover:border-bone/40 hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center border transition-colors",
        on ? "border-bone bg-bone text-ink" : "border-bone/25",
      )}
    >
      {on && <Check className="size-3" />}
    </span>
  );
}

function PriceField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-2 border border-bone/15 px-3.5 focus-within:border-bone/40">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-h-11 w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-sm"
      />
      <span className="text-[12px] text-ash">€</span>
    </label>
  );
}
