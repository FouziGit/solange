"use client";

import { motion } from "motion/react";

/**
 * Bouton du rail d'actions des cartes feed (like, commenter, garder, cintre…).
 * Primitive unique — remplace les trois copies locales (ActionRail.Action,
 * ShopCard.RailButton, MemberPostCard.RailAction). Rond par la règle DA §4 :
 * il vit posé SUR le média. Cible ≥ 44px (48px), label toujours visible.
 *
 * Nom accessible = libellé visible (Commande vocale : « Touche Garder »),
 * éventuellement complété par `hint` (« 12 » → « 12 j'aime »). L'état passe
 * par `pressed` (aria-pressed) seul : le libellé d'une bascule reste fixe.
 */
export function RailAction({
  children,
  label,
  hint,
  onClick,
  accent,
  pressed,
}: {
  children: React.ReactNode;
  label: string;
  /** Complément lu après le libellé visible, jamais à sa place. */
  hint?: string;
  onClick?: () => void;
  accent?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cursor="link"
      aria-label={hint ? `${label} ${hint}` : undefined}
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

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * Partage natif (feuille iOS / Android), sinon copie du lien. Ne lève
 * jamais : l'appelant annonce le résultat.
 */
export async function shareOrCopy(
  data: { title: string; url: string },
  nav: ShareNavigator | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): Promise<ShareOutcome> {
  if (nav?.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (e) {
      // feuille de partage fermée : ce n'est pas une erreur
      if ((e as { name?: string } | null)?.name === "AbortError")
        return "cancelled";
      // partage refusé (contexte, permission) : on se rabat sur la copie
    }
  }
  if (!nav?.clipboard) return "failed";
  try {
    await nav.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
