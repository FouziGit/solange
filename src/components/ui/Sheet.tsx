"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "../chrome/icons";

/**
 * Bottom-sheet unique de l'app (chrome partagé : scrim, panneau
 * `rounded-t-stage`, en-tête eyebrow+titre, filet, fermeture). Remplace les
 * quatre copies locales (ShopTheLook, CommentSheet, FilterDrawer, compose).
 * - `container="absolute"` : vit DANS une carte du feed (scrim z-30/40) ;
 *   `"fixed"` : plein viewport (z-40/50).
 * - `desktopSide` : variante FilterDrawer — rail droit à partir de md.
 * - Échap ferme ; le panneau prend le focus à l'ouverture (a11y).
 */
export function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  ariaLabel,
  container = "fixed",
  desktopSide = false,
  maxHeight = "78%",
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: React.ReactNode;
  ariaLabel?: string;
  container?: "fixed" | "absolute";
  desktopSide?: boolean;
  maxHeight?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Portal (fixed uniquement) : sort le panneau du stacking context créé par
  // les transitions de page (template.tsx) — sinon z-[70] reste sous la nav.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* fixed = plein viewport, AU-DESSUS de la tab bar (z-50) et du FAB */
  const pos = container === "fixed" ? "fixed" : "absolute";
  const zScrim = container === "fixed" ? "z-[60]" : "z-30";
  const zPanel = container === "fixed" ? "z-[70]" : "z-40";

  const sheet = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className={`${pos} inset-0 ${zScrim} bg-ink/70 backdrop-blur-[2px]`}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? eyebrow}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            style={{ maxHeight: desktopSide ? undefined : maxHeight }}
            className={`${pos} inset-x-0 bottom-0 ${zPanel} flex flex-col overflow-hidden rounded-t-stage border-t border-bone/15 bg-coal/95 outline-none backdrop-blur-2xl ${
              desktopSide
                ? "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-stage md:border-l md:border-t-0"
                : ""
            }`}
          >
            <div
              className={`flex items-center justify-between px-5 pb-2 pt-4 ${
                desktopSide ? "md:pt-12" : ""
              }`}
            >
              <div>
                <p className="eyebrow text-sm text-bone">{eyebrow}</p>
                <p className="font-display text-xl font-bold tracking-mega text-bone">
                  {title}
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mx-5 h-px bg-bone/10" />

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (container === "fixed") {
    if (!mounted) return null;
    return createPortal(sheet, document.body);
  }
  return sheet;
}
