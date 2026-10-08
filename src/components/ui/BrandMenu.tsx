"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Search } from "../chrome/icons";
import { cn } from "@/lib/utils";

const cle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Menu Marques du Marché — un menu déroulant SOLANGE, pas le sélecteur
 * natif du téléphone. Choix multiples, recherche dans la liste, les
 * maisons phares d'abord, le reste de la base au fil de la saisie.
 * La sélection est partagée avec le tiroir Filtres (même `value`).
 */
export function BrandMenu({
  featured,
  all,
  value,
  onChange,
}: {
  /** maisons affichées d'office, dans cet ordre */
  featured: string[];
  /** toute la base, cherchable */
  all: string[];
  value: string[];
  onChange: (brands: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();

  // fermeture : clic à l'extérieur, Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = useMemo(() => {
    const k = cle(q.trim());
    if (!k) return featured;
    const pool = [...new Set([...featured, ...all])];
    return pool.filter((b) => cle(b).includes(k));
  }, [q, featured, all]);

  const toggle = (b: string) =>
    onChange(value.includes(b) ? value.filter((x) => x !== b) : [...value, b]);

  const label =
    value.length === 0
      ? "Toutes"
      : value.length === 1
        ? value[0]
        : `${value.length} sélectionnées`;

  return (
    <div ref={rootRef} className="relative mt-3 scroll-mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-cursor="link"
        onClick={() => {
          setOpen((o) => !o);
          if (!open)
            setTimeout(() => {
              // le menu remonte en haut : « Valider » reste au-dessus de la
              // barre d'onglets sur téléphone
              rootRef.current?.scrollIntoView({
                block: "start",
                behavior: "smooth",
              });
              searchRef.current?.focus({ preventScroll: true });
            }, 220);
        }}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 border px-4 text-left transition-colors",
          open || value.length
            ? "border-bone text-bone"
            : "border-bone/20 text-bone/80 hover:border-bone/40",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="etiquette shrink-0 text-[11px] text-ash">
            Marques
          </span>
          <span className="truncate text-[13px] font-medium">{label}</span>
        </span>
        <motion.svg
          aria-hidden
          viewBox="0 0 12 12"
          className="size-3 shrink-0"
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
            id={panelId}
            key="panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-30 mt-1 border border-bone/25 bg-noir shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-3 border-b border-bone/10 px-4 py-3">
              <Search className="size-4 shrink-0 text-ash" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Chercher une maison…"
                aria-label="Chercher une marque"
                className="w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-sm"
              />
            </div>

            <ul
              aria-label="Marques"
              className="grid max-h-[46vh] grid-cols-2 gap-x-4 overflow-y-auto overscroll-contain px-2 py-2 md:grid-cols-3"
            >
              {list.length === 0 ? (
                <li className="col-span-full px-2 py-6 text-center text-[12.5px] text-ash">
                  Aucune maison ne s&apos;appelle ainsi.
                </li>
              ) : (
                list.map((b) => {
                  const on = value.includes(b);
                  return (
                    <li key={b}>
                      <button
                        type="button"
                        aria-pressed={on}
                        data-cursor="link"
                        onClick={() => toggle(b)}
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[13.5px] transition-colors",
                          on ? "text-bone" : "text-bone/70 hover:text-bone",
                        )}
                      >
                        <span className="leading-snug">{b}</span>
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-4 shrink-0 place-items-center border transition-colors",
                            on
                              ? "border-bone bg-bone text-ink"
                              : "border-bone/25",
                          )}
                        >
                          {on && <Check className="size-3" />}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-bone/10 px-4 py-2.5">
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={value.length === 0}
                className="min-h-11 text-[12px] text-ash transition-colors hover:text-bone disabled:opacity-40"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 bg-bone px-5 text-[12px] font-semibold text-ink"
              >
                Valider
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
