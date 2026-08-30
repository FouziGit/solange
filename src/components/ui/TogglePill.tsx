"use client";

import { cn } from "@/lib/utils";

/**
 * TogglePill — LE toggle social de l'app : Suivre/Suivi, Rejoindre/Rejoint,
 * Me prévenir/Prévu, Réserver/Réservée. Pill par la règle carré = commerce /
 * rond = organique (DA §4) : suivre quelqu'un est un geste social, pas un
 * achat. off = bloc renversé (l'invite), on = filet + texte posé.
 * Remplace les 7 implémentations divergentes relevées à l'inventaire (§2).
 */
const SIZE = {
  /* contexte dense (rangées, overlay feed) — la rangée hôte reste ≥ 44px */
  sm: "min-h-9 px-4 text-[12px]",
  md: "min-h-11 px-5 text-[13px]",
} as const;

export function TogglePill({
  on,
  onToggle,
  labelOn,
  labelOff,
  iconOn,
  iconOff,
  size = "md",
  switchRole = false,
  className,
  ...rest
}: {
  on: boolean;
  /** Reçoit l'événement — utile pour preventDefault dans un Link hôte. */
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  labelOn: string;
  labelOff: string;
  iconOn?: React.ReactNode;
  iconOff?: React.ReactNode;
  size?: keyof typeof SIZE;
  /** role="switch" (réglage marche/arrêt) au lieu du toggle pressé. */
  switchRole?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-cursor="link"
      {...(switchRole
        ? { role: "switch", "aria-checked": on }
        : { "aria-pressed": on })}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        SIZE[size],
        on
          ? "border border-bone/25 text-bone/70 hover:border-bone/40 hover:text-bone"
          : "bg-bone text-ink hover:bg-bone/90",
        className,
      )}
      {...rest}
    >
      {on ? iconOn : iconOff}
      {on ? labelOn : labelOff}
    </button>
  );
}
