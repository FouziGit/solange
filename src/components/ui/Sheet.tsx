"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 * - Échap ferme ; le panneau prend le focus à l'ouverture, et le rend à
 *   l'élément qui l'avait (le bouton déclencheur) à la fermeture — sauf si
 *   l'appelant l'a déjà posé ailleurs.
 * - Nom de la boîte de dialogue : surtitre + `title` (rendu en <h2>), via
 *   aria-labelledby — deux feuilles « Commande » ne s'annoncent plus pareil.
 *   `ariaLabel` le remplace quand le texte visible ne suffit pas.
 * - Le défilement ne fuit pas vers la page ou le feed (voile en
 *   touch-none, panneau en overscroll-contain) ; Fermer fait 44 px.
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
  // nom de la boîte : surtitre + titre (« Commande, Expédition »)
  const labelId = useId();
  // Portal (fixed uniquement) : sort le panneau du stacking context créé par
  // les transitions de page (template.tsx) — sinon z-[70] reste sous la nav.
  const [mounted, setMounted] = useState(false);
  useEffect(() => queueMicrotask(() => setMounted(true)), []);

  /* `onClose` est presque toujours écrite en ligne par l'appelant, donc
     recréée à CHAQUE rendu. La garder en dépendance d'effet rejouait tout
     le corps à chaque frappe — y compris le `focus()` du panneau, qui
     volait le focus du champ en cours de saisie (une lettre, puis il
     fallait recliquer). On la lit via une ref : l'effet ne dépend plus
     que de `open`. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        // piège de focus : Tab boucle à l'intérieur du panneau (a11y)
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeEl = document.activeElement;
        if (e.shiftKey && (activeEl === first || activeEl === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    /* l'élément qui avait le focus (le déclencheur) le récupère à la
       fermeture : sinon il retombe sur <body> et VoiceOver repart du haut */
    const prev =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    // le focus initial se pose UNE fois, à l'ouverture — jamais pendant
    // que la personne écrit
    panel?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      const active = document.activeElement;
      const lost =
        !active || active === document.body || !!panel?.contains(active);
      if (lost && prev && prev !== document.body && prev.isConnected)
        prev.focus({ preventScroll: true });
    };
  }, [open]);

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
            /* `pointer-events-none` quand la feuille se ferme : le nœud peut
               survivre à l'animation de sortie (AnimatePresence dans un
               portail ne le démonte pas toujours). Invisible mais toujours
               `fixed inset-0`, il intercepterait TOUS les clics de la page.
               Vérifié en prod : le voile finit bien à `opacity: 0`, mais il
               reste dans le DOM — donc on le neutralise explicitement. */
            className={`${pos} inset-0 ${zScrim} touch-none bg-ink/70 backdrop-blur-[2px] ${
              open ? "" : "pointer-events-none"
            }`}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={
              ariaLabel ? undefined : `${labelId}-surtitre ${labelId}-titre`
            }
            /* une fois fermé, le panneau résiduel ne doit ni capter un clic
               ni être annoncé comme une boîte de dialogue ouverte */
            aria-hidden={open ? undefined : true}
            inert={open ? undefined : true}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            style={{ maxHeight: desktopSide ? undefined : maxHeight }}
            className={`${pos} inset-x-0 bottom-0 ${zPanel} ${
              open ? "" : "pointer-events-none"
            } flex flex-col overflow-hidden overscroll-contain rounded-t-stage border-t border-bone/15 bg-coal/95 outline-none backdrop-blur-2xl ${
              desktopSide
                ? "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-stage md:border-l md:border-t-0"
                : ""
            }`}
          >
            <div
              className={`flex items-center justify-between px-5 pb-2 pt-4 ${
                desktopSide ? "md:pt-12" : ""
              } ${container === "absolute" ? "touch-none" : ""}`}
            >
              <div>
                <p
                  id={`${labelId}-surtitre`}
                  className="eyebrow text-sm text-bone"
                >
                  {eyebrow}
                </p>
                <h2
                  id={`${labelId}-titre`}
                  className="font-display text-xl font-bold tracking-mega text-bone"
                >
                  {title}
                </h2>
              </div>
              {/* 44 px de zone tactile (HIG) autour du rond visible de 36 px */}
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-bone"
                aria-label="Fermer"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-full bg-bone/10"
                >
                  <X className="size-5" />
                </span>
              </button>
            </div>

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
