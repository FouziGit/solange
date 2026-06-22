"use client";

import { cn } from "@/lib/utils";

/** Selectable editorial pill (filters, categories, sizes). Strict noir & blanc. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-cursor="link"
      className={cn(
        "whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-bone bg-bone text-ink"
          : "border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone",
      )}
    >
      {children}
    </button>
  );
}
