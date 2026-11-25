"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Search, X } from "@/components/chrome/icons";
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
 * Rien de coché veut dire aucun filtre. Un choix se marque par un filet fort
 * et un point plein (Chip, Tick) : le seul bloc renversé est « Voir N pièces ».
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
      cats: [],
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
      // les marques choisies hors de celles en vente restent visibles en tête
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
      {/* min-h-0 : sans lui, la zone ne rétrécit pas sous son contenu et
          ne défile jamais — la liste des marques sortait de l'écran */}
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pb-4">
        <Row
          label="Trier par"
          role="radiogroup"
          summary={SORTS.find((s) => s.key === value.sort)?.label ?? ""}
          {...sec("tri")}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                radio
                active={value.sort === s.key}
                onClick={() => set("sort", s.key)}
              >
                {s.label}
              </Chip>
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
            {categories.map((c) => (
              <Chip
                key={c}
                active={value.cats.includes(c)}
                onClick={() => set("cats", toggle(value.cats, c))}
              >
                {c}
              </Chip>
            ))}
          </div>
        </Row>

        <Row
          label="Marques"
          summary={resume(value.brands, "Toutes")}
          active={value.brands.length > 0}
          {...sec("marques")}
        >
          {/* collée en haut pendant qu'on parcourt la liste */}
          <div className="sticky top-0 z-10 -mx-5 bg-coal px-5 pb-2 pt-1">
            <div className="flex items-center gap-3 border border-[var(--field-border)] bg-ink/40 px-3.5 focus-within:border-[var(--field-border-focus)]">
              <Search className="size-4 shrink-0 text-ash" />
              <input
                type="search"
                enterKeyHint="search"
                value={brandQ}
                onChange={(e) => setBrandQ(e.target.value)}
                placeholder="Rechercher une marque…"
                aria-label="Rechercher une marque"
                className="min-h-11 w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {brandQ && (
                <button
                  type="button"
                  onClick={() => setBrandQ("")}
                  aria-label="Effacer la recherche"
                  className="-mr-2 grid size-11 shrink-0 place-items-center text-ash hover:text-bone"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ash">
              {brandQ.trim()
                ? `${brandList.length} marque${brandList.length > 1 ? "s trouvées" : " trouvée"}.`
                : `${featuredBrands.length} marque${featuredBrands.length > 1 ? "s" : ""} en vente. Tape un nom pour chercher parmi ${allBrands.length}.`}
              {value.brands.length > 0 &&
                ` ${value.brands.length} sélectionnée${value.brands.length > 1 ? "s" : ""}.`}
            </p>
          </div>
          {/* sans recherche et sans marque en vente : rien à lister */}
          {brandList.length > 0 ? (
            <ul aria-label="Marques" className="mt-2 grid grid-cols-2 gap-x-4">
              {brandList.map((b) => {
                const on = value.brands.includes(b);
                return (
                  <li key={b}>
                    <button
                      type="button"
                      aria-pressed={on}
                      data-cursor="link"
                      onClick={() => set("brands", toggle(value.brands, b))}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 py-1.5 text-left text-[13.5px] leading-snug transition-colors",
                        on ? "text-bone" : "text-bone/65 hover:text-bone",
                      )}
                    >
                      {/* le point à gauche du mot, comme sur Chip */}
                      <Tick on={on} />
                      <span>{b}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            brandQ.trim() && (
              <p className="mt-2 py-6 text-center text-[12.5px] text-ash">
                Aucune marque ne s&apos;appelle ainsi.
              </p>
            )
          )}
        </Row>

        <Row
          label="Tailles"
          summary={resume([...clothes, ...shoes], "Toutes", 4)}
          active={value.sizes.length > 0}
          {...sec("tailles")}
        >
          <p className="etiquette mb-2 text-[11px] text-ash">Vêtements</p>
          <div className="flex flex-wrap gap-1.5">
            {clothingSizes.map((s) => (
              <Chip
                key={s}
                active={value.sizes.includes(s)}
                onClick={() => set("sizes", toggle(value.sizes, s))}
              >
                {s}
              </Chip>
            ))}
          </div>
          <p className="etiquette mb-2 mt-5 text-[11px] text-ash">Chaussures</p>
          <div className="flex flex-wrap gap-1.5">
            {shoeSizes.map((s) => (
              <Chip
                key={s}
                active={value.sizes.includes(s)}
                onClick={() => set("sizes", toggle(value.sizes, s))}
              >
                {s}
              </Chip>
            ))}
          </div>
        </Row>

        <Row
          label="État"
          summary={resume(value.conds, "Tous", 1)}
          active={value.conds.length > 0}
          {...sec("etat")}
        >
          <div className="flex flex-wrap gap-1.5">
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

/** Une section dépliable : libellé, résumé du choix, chevron. Le bloc déplié
    est un groupe nommé par le libellé seul (« Catégories », pas « Catégories
    Toutes ») ; `radiogroup` pour un choix unique. */
function Row({
  label,
  summary,
  active = false,
  role = "group",
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  active?: boolean;
  role?: "group" | "radiogroup";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const labelId = useId();
  // overflow-hidden le temps du dépliage seulement : ouvert, il casserait
  // la recherche collante des marques
  const [settled, setSettled] = useState(false);
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
        <span id={labelId} className="text-[15px] font-medium text-bone">
          {label}
        </span>
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
            role={role}
            aria-labelledby={labelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onAnimationStart={() => setSettled(false)}
            onAnimationComplete={() => setSettled(open)}
            className={settled && open ? "overflow-visible" : "overflow-hidden"}
          >
            <div className="pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center border transition-colors",
        on ? "border-line-strong" : "border-line",
      )}
    >
      {on && <span className="size-1.5 rounded-full bg-bone" />}
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
    <label className="flex flex-1 items-center gap-2 border border-[var(--field-border)] px-3.5 focus-within:border-[var(--field-border-focus)]">
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
