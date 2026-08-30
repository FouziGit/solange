/**
 * Squelettes de chargement — reproduisent la mise en page à venir (jamais de
 * spinner plein écran, DA §Phase 3). Pulsation d'opacité sobre, coupée sous
 * prefers-reduced-motion (géré par la règle globale `motion-reduce`).
 */
import { cn } from "@/lib/utils";

/** Bloc squelette générique — dimensionner via className. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-none bg-bone/[0.07] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Tuile pièce (grilles Marché / profil public). */
export function SkeletonTile() {
  return (
    <div className="mb-3 break-inside-avoid">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="mt-3 h-2.5 w-1/3" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/4" />
    </div>
  );
}

/** Rangée de liste (notifications, conversations, ventes). */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-2 h-3 w-2/5" />
      </div>
    </div>
  );
}
