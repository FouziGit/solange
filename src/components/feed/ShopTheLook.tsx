"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { Product } from "@/lib/mock";
import { euro, gradientFor, initials } from "@/lib/utils";
import { Bag, ChevronUp, X } from "../chrome/icons";

export function ShopTheLook({
  products,
  open,
  onOpenChange,
  highlightId,
}: {
  products: Product[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  highlightId: string | null;
}) {
  const minPrice = Math.min(...products.map((p) => p.priceEUR));

  return (
    <>
      {/* trigger pill */}
      <motion.button
        onClick={() => onOpenChange(true)}
        data-cursor="link"
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-bone/15"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone text-ink">
          <Bag className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-bone">
            Shop the look
          </span>
          <span className="block text-[11px] text-ash">
            {products.length} pièce{products.length > 1 ? "s" : ""} · dès{" "}
            {euro(minPrice)}
          </span>
        </span>
        <ChevronUp className="size-5 text-bone/80" />
      </motion.button>

      {/* drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="absolute inset-0 z-30 bg-ink/70 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="absolute inset-x-0 bottom-0 z-40 max-h-[78%] overflow-hidden rounded-t-[28px] border-t border-bone/15 bg-coal/95 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <div>
                  <p className="eyebrow text-sm text-bone">Shop the look</p>
                  <p className="font-display text-xl font-bold tracking-mega text-bone">
                    {products.length} pièce{products.length > 1 ? "s" : ""} à
                    chiner
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone"
                  aria-label="Fermer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mx-5 h-px bg-bone/10" />

              <div className="flex flex-col gap-2 overflow-y-auto px-5 py-4">
                {products.map((p) => {
                  const hot = highlightId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      className={`flex items-center gap-3 rounded-2xl p-2 transition-colors ${
                        hot
                          ? "bg-bone/10 ring-1 ring-bone/40"
                          : "bg-bone/[0.03]"
                      }`}
                    >
                      <span
                        className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
                        style={{ background: gradientFor(p.id) }}
                        aria-hidden="true"
                      >
                        <span className="font-display text-lg font-black text-bone/25">
                          {initials(p.brand)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="overline text-[9px] text-ash">
                          {p.brand}
                        </p>
                        <p className="truncate text-sm font-medium text-bone">
                          {p.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ash">
                          <span>Taille {p.size}</span>
                          <span className="size-0.5 rounded-full bg-ash" />
                          <span>{p.condition}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="text-right leading-none">
                          <span className="font-display text-base font-bold text-bone">
                            {euro(p.priceEUR)}
                          </span>
                          {p.originalEUR && (
                            <span className="ml-1 text-[10px] text-ash line-through">
                              {euro(p.originalEUR)}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/article/${p.id}`}
                          data-cursor="link"
                          aria-label={`Acheter ${p.name}`}
                          className="rounded-full bg-bone px-3.5 py-1.5 text-[11px] font-semibold text-ink transition-transform active:scale-95"
                        >
                          Acheter
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-bone/10 px-5 pb-24 pt-4 md:pb-5">
                <span className="text-xs text-ash">
                  Protection acheteur incluse · livraison 48h
                </span>
                <button className="rounded-full bg-bone px-5 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95">
                  Tout ajouter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
