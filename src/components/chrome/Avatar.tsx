import { cn, gradientFor, initials } from "@/lib/utils";
import { PORTRAIT_SEEDS, imgPerson } from "@/lib/img";
import { Photo } from "../ui/Photo";

/** La photo à poser sur le monogramme. `src` chaîne : la photo du membre
    (vide : aucune). `src` null : le membre n'en a pas, initiales seules.
    Le portrait de démo n'apparaît que si `src` n'est pas fourni du tout
    et que la graine en a un : un membre réel ne peut ni déclencher un 404
    par rendu, ni prendre le visage d'un créateur de démonstration. */
export function avatarPhoto(
  seed: string,
  src: string | null | undefined,
): string | null {
  if (typeof src === "string") return src || null;
  if (src === undefined && PORTRAIT_SEEDS.has(seed)) return imgPerson(seed);
  return null;
}

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
  src,
  className,
  decorative = false,
}: {
  name: string;
  seed: string;
  src?: string | null;
  className?: string;
  decorative?: boolean;
}) {
  const photo = avatarPhoto(seed, src);
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
      {photo && <Photo src={photo} alt="" className="rounded-full" />}
    </span>
  );
}
