"use client";

import { motion } from "motion/react";

/**
 * Bouton du rail d'actions des cartes feed (like, commenter, garder, cintre…).
 * Primitive unique — remplace les trois copies locales (ActionRail.Action,
 * ShopCard.RailButton, MemberPostCard.RailAction). Rond par la règle DA §4 :
 * il vit posé SUR le média. Cible ≥ 44px (48px), label toujours visible.
 */
export function RailAction({
  children,
  label,
  onClick,
  accent,
  pressed,
  ariaLabel,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  accent?: boolean;
  pressed?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-cursor="link"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1"
    >
      <motion.span
        whileHover={{ y: -2, scale: 1.06 }}
        whileTap={{ scale: 0.8 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={`grid size-12 place-items-center rounded-full transition-colors ${
          accent ? "glass-bone" : "glass"
        } group-hover:bg-bone/15`}
      >
        {children}
      </motion.span>
      <span className="text-[11px] font-semibold text-bone/90 tabular-nums">
        {label}
      </span>
    </button>
  );
}
