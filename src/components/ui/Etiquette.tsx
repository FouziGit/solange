import {
  libelleLook,
  libellePiece,
  nPieces,
  niveauEtat,
  numeroPassage,
} from "@/lib/etiquette";
import type { Item } from "@/lib/mock";
import { cn, euro } from "@/lib/utils";

type Piece = Pick<Item, "size" | "priceEUR">;

export type EtiquetteProps = { className?: string } & (
  | { variant: "carte" | "barre"; item: Piece }
  | { variant: "vendue"; item: Pick<Item, "size"> }
  | {
      variant: "fiche";
      item: Piece & Pick<Item, "brand" | "name" | "condition">;
      sold?: boolean;
    }
  | { variant: "look"; index: number; pieces?: number; onOpen?: () => void }
);

/* Surface posée, filet fort, angles vifs. Ni ombre, ni dégradé, ni flou, ni
   opacité sur l'étiquette ou ses textes. */
const PAPIER = "border border-line-strong bg-coal text-bone";
const BANDE = `flex items-center ${PAPIER}`;
const CHIFFRE = "font-display font-extrabold tabular-nums";
/* Débordement des bandes : la taille d'une pièce de membre est un texte libre
   (12 caractères au plus), deux lignes de 12 px tiennent dans 36 px ; le prix
   ne se coupe jamais. La hauteur ne bouge pas. */
const TAILLE =
  "min-w-0 pl-1.5 pr-1 font-display text-[12px] font-bold line-clamp-2 break-words leading-[1.15]";
const PRIX = `${CHIFFRE} shrink-0 whitespace-nowrap`;
/* Fiche : marges de 10 px, 16 px dès que le corps fait 384 px. */
const MARGE = "px-2.5 @sm:px-4";
const CASE = `flex flex-col py-3 ${MARGE}`;
const LIBELLE = "etiquette text-[11px] text-ash";

/**
 * L'étiquette (DA §9) : le seul objet qui décrit une pièce ou un look. Jamais
 * un décor, jamais un libellé de champ.
 *
 * - `carte` : bande de 36 px collée sous la photo (taille, prix).
 * - `vendue` : la même, « VENDUE » tamponné à la place du prix.
 * - `barre` : bande de 52 px de la barre d'achat, muette (la fiche a déjà dit
 *   taille et prix).
 * - `fiche` : la page d'une pièce. Elle rend le `h1` (marque et nom) : une
 *   seule par page. Rien n'y est coupé, c'est la seule source.
 * - `look` : le numéro de passage sur le fil, renversée (bone, texte ink).
 *   Avec `onOpen`, c'est un bouton qui ouvre les pièces du look.
 */
export function Etiquette(props: EtiquetteProps): React.JSX.Element {
  const { className } = props;

  if (props.variant === "look") {
    const { index, pieces = 0, onOpen } = props;
    /* ash sur bone tombe à 2,56:1 : ici tout le texte est ink, jamais
       text-ash ni .etiquette. */
    const classe = cn(
      "inline-flex h-9 items-center bg-bone text-ink",
      className,
    );
    const contenu = (
      <>
        <Talon trait="border-ink/45" />
        <span className={cn(CHIFFRE, "px-2.5 text-[15px]")}>
          {numeroPassage(index)}
        </span>
        {pieces > 0 && (
          <>
            <span className="self-stretch border-l border-ink/20" />
            <span className="px-2.5 text-[11px] font-semibold text-ink/70">
              {nPieces(pieces)}
            </span>
          </>
        )}
      </>
    );
    if (!onOpen) {
      return (
        <span aria-hidden className={classe}>
          {contenu}
        </span>
      );
    }
    /* cible de 44 px : le pseudo-élément ne déborde que vers le haut, la
       rangée du pseudo est juste dessous */
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={libelleLook(index, pieces)}
        aria-haspopup="dialog"
        data-cursor="link"
        className={cn(
          classe,
          "relative before:absolute before:inset-x-0 before:-top-2 before:bottom-0 before:content-['']",
        )}
      >
        {contenu}
      </button>
    );
  }

  if (props.variant === "fiche") {
    const { item, sold } = props;
    const niveau = niveauEtat(item.condition);
    // la marge haute est le trajet du fil : sans fil (dès lg), pas de marge
    return (
      <div className={cn("mt-4 flex lg:mt-0", PAPIER, className)}>
        <Talon fiche />
        <div className="@container min-w-0 flex-1">
          <h1 className={`py-3.5 ${MARGE}`}>
            <span className="block break-words font-display text-[22px] font-extrabold uppercase leading-[1.1]">
              {item.brand}
            </span>{" "}
            <span className="mt-0.5 block break-words text-[17px] font-normal leading-[1.3]">
              {item.name}
            </span>
          </h1>
          {/* Trois cases de front dès que le corps fait 312 px (écran de
              390 px). Plus étroit, le prix passe dessous : rien ne se
              chevauche, même à 320 px. */}
          <dl className="grid grid-cols-2 border-t border-line @[19.5rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className={CASE}>
              <dt className={LIBELLE}>Taille</dt>
              <dd
                className={cn(
                  CHIFFRE,
                  "mt-auto break-words pt-2 text-[22px] leading-[1.1]",
                )}
              >
                {item.size}
              </dd>
            </div>
            <div className={cn(CASE, "border-l border-line")}>
              <dt className={LIBELLE}>État</dt>
              <dd className="mt-auto flex flex-col gap-1.5 pt-2">
                {niveau > 0 && <Crans niveau={niveau} />}
                <span className="break-words text-[13.5px] leading-tight">
                  {item.condition}
                </span>
              </dd>
            </div>
            <div
              className={cn(
                CASE,
                "col-span-2 border-t border-line @[19.5rem]:col-span-1 @[19.5rem]:border-l @[19.5rem]:border-t-0",
              )}
            >
              <dt className={LIBELLE}>Prix</dt>
              <dd className={cn(PRIX, "mt-auto pt-2 text-[34px] leading-none")}>
                {sold ? <Tampon /> : euro(item.priceEUR)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  if (props.variant === "barre") {
    /* Muette et redondante : s'il reste moins de 32 px après le prix, la
       taille passe à la ligne et sort du cadre, plutôt que de s'afficher
       tronquée. */
    return (
      <div
        aria-hidden
        className={cn(BANDE, "h-13 flex-wrap overflow-hidden", className)}
      >
        <Talon />
        <span
          className={cn(PRIX, "flex h-full items-center px-2.5 text-[17px]")}
        >
          {euro(props.item.priceEUR)}
        </span>
        <span className="flex h-full min-w-0 flex-1 basis-8 items-center border-l border-line">
          <span className={TAILLE}>T. {props.item.size}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn(BANDE, "h-9", className)}>
      <Talon />
      <span
        aria-hidden
        className={cn(TAILLE, props.variant === "vendue" && "text-ash")}
      >
        T. {props.item.size}
      </span>
      <span className="self-stretch border-l border-line" />
      <span
        aria-hidden
        className={cn(
          PRIX,
          "flex grow items-center justify-end pl-1 pr-2 text-[15px]",
        )}
      >
        {props.variant === "vendue" ? <Tampon /> : euro(props.item.priceEUR)}
      </span>
      <span className="sr-only">
        {libellePiece(
          props.variant === "vendue" ? { size: props.item.size } : props.item,
        )}
      </span>
    </div>
  );
}

/** Le talon : fermé par une perforation, il ne porte que l'œillet (le poinçon
    de la DA §9, seul rond de l'objet). Sur la fiche, l'œillet est en haut et
    un fil le relie au bord bas de la photo, 16 px plus haut. */
function Talon({
  fiche = false,
  trait = "border-line-strong",
}: {
  fiche?: boolean;
  trait?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 justify-center self-stretch border-r border-dashed",
        trait,
        fiche ? "w-7 pt-3" : "w-5 items-center",
      )}
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full border",
          trait,
          fiche ? "size-[18px]" : "size-[9px]",
        )}
      >
        <span
          className={cn(
            "rounded-full bg-[var(--background)]",
            fiche ? "size-2" : "size-1",
          )}
        />
        {fiche && (
          <span
            aria-hidden
            className="absolute bottom-1/2 left-1/2 h-[38px] w-px -translate-x-1/2 bg-bone lg:hidden"
          />
        )}
      </span>
    </span>
  );
}

/** L'état en crans, à l'essai sur la fiche seulement : un décor, c'est le mot
    qui porte l'information. */
function Crans({ niveau }: { niveau: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {[1, 2, 3, 4].map((cran) => (
        <span
          key={cran}
          className={cn(
            "size-2.5 border border-line-strong",
            cran <= niveau && "bg-bone",
          )}
        />
      ))}
    </span>
  );
}

/** « VENDUE », immobile. Ce n'est pas Stamp, qui s'anime une fois, aux jalons. */
function Tampon() {
  return (
    <span className="inline-block -rotate-2 border-[1.5px] border-bone py-1 pl-1.5 pr-1 font-display text-[11px] font-extrabold uppercase leading-none tracking-[0.14em]">
      Vendue
    </span>
  );
}
