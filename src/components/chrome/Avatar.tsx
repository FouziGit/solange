import { cn, gradientFor, initials } from "@/lib/utils";
import { imgPerson } from "@/lib/img";
import { Photo } from "../ui/Photo";

/** Monogram avatar with a real portrait overlay (falls back to the monogram). */
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
        "relative grid place-items-center overflow-hidden rounded-full",
        className,
      )}
      style={{ background: gradientFor(seed) }}
    >
      <span className="font-display text-[0.42em] font-bold tracking-wide text-bone/85">
        {initials(name)}
      </span>
      <Photo src={imgPerson(seed)} alt={name} className="rounded-full" />
    </span>
  );
}
