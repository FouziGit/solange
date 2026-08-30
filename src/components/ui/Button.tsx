"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "media" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  /* le bloc renversé — UNE seule occurrence par écran (DA §2) ; carré (DA §4) */
  primary:
    "rounded-none bg-bone font-semibold text-ink hover:bg-bone/90 active:scale-[0.98]",
  /* action secondaire — filet, carré */
  outline:
    "rounded-none border border-bone/25 font-semibold text-bone hover:border-bone/60 active:scale-[0.98]",
  /* posé SUR un média — pill glass (organique, DA §4) */
  media:
    "rounded-full glass font-semibold text-bone hover:bg-bone/15 active:scale-95",
  /* destructif — oxblood sourd, carré */
  danger:
    "rounded-none bg-danger font-semibold text-noir hover:opacity-90 active:scale-[0.98]",
  /* texte seul — liens d'action discrets */
  ghost:
    "rounded-none font-medium text-ash underline-offset-4 hover:text-bone hover:underline",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[12px]",
  md: "min-h-11 px-5 text-[13.5px]",
  lg: "min-h-12 w-full px-6 text-[15px]",
};

/**
 * CTA unique de l'app. `href` → <Link>, sinon <button>. Toujours un verbe
 * d'action en libellé (DA §8). Cibles ≥ 44px en md/lg ; sm réservé aux
 * contextes denses (listes) où la rangée entière reste ≥ 44px.
 */
export function Button({
  variant = "primary",
  size = "md",
  href,
  className,
  type = "button",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">) {
  const cls = cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-[background-color,border-color,opacity,transform] disabled:cursor-not-allowed disabled:opacity-40",
    VARIANT[variant],
    SIZE[size],
    className,
  );
  if (href) {
    const { onClick, "aria-label": ariaLabel, target, rel } = rest;
    return (
      <Link
        href={href}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        aria-label={ariaLabel}
        target={target}
        rel={rel}
        data-cursor="link"
        className={cls}
      >
        {children}
      </Link>
    );
  }
  return (
    <button type={type} data-cursor="link" className={cls} {...rest}>
      {children}
    </button>
  );
}
