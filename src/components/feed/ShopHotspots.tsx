"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Product } from "@/lib/mock";
import { euro } from "@/lib/utils";

/**
 * On-media shoppable pins — the pieces that "pop out" of a look. Each hotspot
 * sits over its garment (% coords from the dataset), pulses to draw the eye,
 * and expands into a brand + price chip when the card is active. Tapping one
 * opens the Shop-the-look drawer with that piece highlighted.
 *
 * Only rendered for looks that actually carry products — content-only posts
 * (actu / achats) pass an empty list, so shoppable and pure-inspiration posts
 * alternate naturally down the feed.
 */
export function ShopHotspots({
  products,
  active,
  onSelect,
}: {
  products: Product[];
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  if (products.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15]"
      aria-hidden={!active}
    >
      <AnimatePresence>
        {active &&
          products.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              data-cursor="link"
              aria-label={`${p.brand} — ${p.name}, ${euro(p.priceEUR)}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 22,
                delay: 0.35 + i * 0.12,
              }}
              style={{
                left: `${p.hotspot.x}%`,
                top: `${p.hotspot.y}%`,
              }}
              className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
            >
              {/* pulsing dot — the "pop out" beacon */}
              <span className="relative grid size-6 shrink-0 place-items-center">
                {!reduce && (
                  <span className="absolute inline-flex size-full rounded-full bg-bone/70 pulse-ring" />
                )}
                <span className="relative grid size-6 place-items-center rounded-full bg-bone text-ink shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  <span className="text-[13px] font-bold leading-none">+</span>
                </span>
              </span>

              {/* brand + price chip that expands out of the pin */}
              <motion.span
                initial={{ opacity: 0, x: -6, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                className="glass flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[11px] leading-none"
              >
                <span className="font-semibold text-bone">{p.brand}</span>
                <span className="size-0.5 rounded-full bg-ash" />
                <span className="font-display font-bold text-bone">
                  {euro(p.priceEUR)}
                </span>
              </motion.span>
            </motion.button>
          ))}
      </AnimatePresence>
    </div>
  );
}
