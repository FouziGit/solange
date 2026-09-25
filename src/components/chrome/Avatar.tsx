import { cn, gradientFor, initials } from "@/lib/utils";
import { imgPerson } from "@/lib/img";
import { Photo } from "../ui/Photo";

/**
 * Monogram avatar with a real portrait overlay (falls back to the monogram).
 * Lu UNE fois : « Nouh B » (role="img"), jamais « NB, Nouh B » — les
 * initiales sont masquées, et le nom tient même si la photo ne charge pas.
 * `decorative` : le nom est déjà écrit à côté (liste, en-tête de fil) ou le
 * lien hôte a son propre nom — l'avatar est alors ignoré.
 */
export function Avatar({
  name,
  seed,
  className,
  decorative = false,
}: {
  name: string;
  seed: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-full",
        className,
      )}
      style={{ background: gradientFor(seed) }}
    >
      {/* gradientFor est toujours sombre : initiales claires même en thème
          clair (sinon ~1.2:1 quand le portrait ne charge pas) */}
      <span
        aria-hidden="true"
        className="theme-dark font-display text-[0.42em] font-bold tracking-wide text-bone/85"
      >
        {initials(name)}
      </span>
      <Photo src={imgPerson(seed)} alt="" className="rounded-full" />
    </span>
  );
}
