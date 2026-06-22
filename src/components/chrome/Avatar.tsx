import { cn, gradientFor, initials } from "@/lib/utils";

/** Deterministic monogram avatar — no network, on-brand monochrome. */
export function Avatar({
  name,
  seed,
  className,
}: {
  name: string;
  seed: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-full",
        className,
      )}
      style={{ background: gradientFor(seed) }}
    >
      <span className="font-display text-[0.42em] font-bold tracking-wide text-bone/85">
        {initials(name)}
      </span>
    </span>
  );
}
