"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Product } from "@/lib/mock";
import { euro } from "@/lib/utils";
import { Bag } from "../chrome/icons";

export function ProductHotspots({
  products,
  onOpen,
}: {
  products: Product[];
  onOpen: (productId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // ref'd timer so a re-enter (incl. diagonal moves to an adjacent hotspot)
  // cancels a pending close before it fires — this is what kills the flicker.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };
  const openNow = (id: string) => {
    cancelClose();
    setOpen(id);
  };

  useEffect(() => cancelClose, []);

  return (
    <div className="absolute inset-0">
      {/* outside-tap scrim for touch dismiss (only while a popover is open) */}
      {open && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(null)}
          className="absolute inset-0 z-10 cursor-default"
        />
      )}

      {products.map((p) => {
        const isOpen = open === p.id;
        // horizontal anchoring so the popover never spills outside the card
        const align =
          p.hotspot.x > 65 ? "right" : p.hotspot.x < 35 ? "left" : "center";
        const posCls =
          align === "right"
            ? "right-0"
            : align === "left"
              ? "left-0"
              : "left-1/2 -translate-x-1/2";
        const bridgeCls =
          align === "right"
            ? "before:right-3"
            : align === "left"
              ? "before:left-3"
              : "before:left-1/2 before:-translate-x-1/2";

        return (
          <div
            key={p.id}
            className="absolute z-20"
            style={{ left: `${p.hotspot.x}%`, top: `${p.hotspot.y}%` }}
          >
            {/* ONE relative container owns the hover state for trigger +
                popover, so the cursor crossing the bridged gap never triggers
                a real mouseleave->close. Hover handlers are no-ops on touch
                (taps drive the onClick toggle instead). */}
            <div
              className="relative -translate-x-1/2 -translate-y-1/2"
              onMouseEnter={() => openNow(p.id)}
              onMouseLeave={scheduleClose}
            >
              <button
                data-cursor="link"
                onClick={() => setOpen(isOpen ? null : p.id)}
                aria-label={`Voir ${p.name}`}
                aria-expanded={isOpen}
                className="group grid size-11 place-items-center rounded-full"
              >
                {/* transparent 44px hit box wraps the 24px pulsing dot */}
                <span className="pulse-ring grid size-6 place-items-center rounded-full border border-bone/80 bg-black/25 backdrop-blur transition-transform group-hover:scale-125">
                  <span className="size-1.5 rounded-full bg-bone" />
                </span>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className={`glass absolute top-full z-20 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-2xl p-3 before:absolute before:-top-4 before:h-4 before:w-20 before:content-[''] ${posCls} ${bridgeCls}`}
                  >
                    <p className="overline text-[9px] text-bone/55">
                      {p.brand}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-snug text-bone">
                      {p.name}
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-display text-lg font-bold text-bone">
                        {euro(p.priceEUR)}
                      </span>
                      {p.originalEUR && (
                        <span className="text-xs text-ash line-through">
                          {euro(p.originalEUR)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ash">
                      <span>Taille {p.size}</span>
                      <span className="size-0.5 rounded-full bg-ash" />
                      <span>{p.condition}</span>
                    </div>
                    <button
                      onClick={() => onOpen(p.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-bone py-2 text-xs font-semibold text-ink transition-transform active:scale-95"
                    >
                      <Bag className="size-4" /> Shop the look
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
