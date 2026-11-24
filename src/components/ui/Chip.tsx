"use client";

import { cn } from "@/lib/utils";

/**
 * Selectable editorial chip (filters, categories, sizes) — sharp brutalist rectangle. Strict noir & blanc.
 *
 * Choisi = filet fort + point plein à gauche du mot, jamais le renversement
 * (réservé à l'action primaire de l'écran, DA §2). Le point vit dans la marge
 * gauche : le chip ne change pas de largeur.
 *
 * - par défaut : bouton bascule (aria-pressed), pour les choix multiples.
 * - `radio` : choix UNIQUE (catégorie, état, transporteur, motif) —
 *   role="radio" + aria-checked, et les flèches passent au choix voisin.
 *   Le conteneur porte le nom de la question :
 *   `<div role="radiogroup" aria-labelledby={idDuFieldLabel}>`.
 */
export function Chip({
  active,
  onClick,
  radio = false,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  radio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(radio
        ? {
            role: "radio",
            "aria-checked": !!active,
            onKeyDown: moveInRadioGroup,
          }
        : { "aria-pressed": active })}
      data-cursor="link"
      className={cn(
        "relative inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-none border px-4 text-[13px] font-medium transition-colors",
        active
          ? "border-line-strong text-bone"
          : "border-line text-bone/70 hover:border-line-strong hover:text-bone",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-bone"
        />
      )}
      {children}
    </button>
  );
}

const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Flèches dans un role="radiogroup" : focus ET choix du voisin (APG). */
function moveInRadioGroup(e: React.KeyboardEvent<HTMLButtonElement>) {
  const step = STEP[e.key];
  const group = e.currentTarget.closest('[role="radiogroup"]');
  if (!step || !group) return;
  const radios = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'),
  );
  const i = radios.indexOf(e.currentTarget);
  if (i < 0) return;
  const next = radios[(i + step + radios.length) % radios.length];
  e.preventDefault();
  next.focus();
  next.click();
}
