import { cn } from "@/lib/utils";

/**
 * Standard inner-page wrapper: clears the rails/tab-bar.
 * Page entrance is owned by `template.tsx` — this shell only handles padding
 * and an optional faint editorial frame (left-margin Bodoni word + folio).
 */
export function PageShell({
  children,
  className,
  marginWord,
}: {
  children: React.ReactNode;
  className?: string;
  marginWord?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[100dvh] px-5 pt-10 md:px-12 md:pt-14",
        "pb-[var(--tabbar-clearance)] md:pb-16",
        className,
      )}
    >
      {marginWord && (
        <>
          {/* faint vertical Bodoni word along the left margin */}
          <span
            aria-hidden="true"
            className="font-editorial pointer-events-none fixed left-2 top-1/2 hidden -translate-y-1/2 -rotate-90 select-none text-7xl italic tracking-tight text-bone/[0.04] md:block lg:text-8xl"
          >
            {marginWord}
          </span>
          {/* bottom-corner folio eyebrow */}
          <span
            aria-hidden="true"
            className="eyebrow pointer-events-none fixed bottom-6 right-12 hidden select-none text-[11px] text-bone/15 md:block"
          >
            Solange — Éditorial
          </span>
        </>
      )}
      {children}
    </div>
  );
}
