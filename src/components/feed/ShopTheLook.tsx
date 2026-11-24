"use client";

import { Sheet } from "../ui/Sheet";
import { ProductCard, type DisplayItem } from "../ui/ProductCard";
import { useSyncExternalStore } from "react";
import { nPieces } from "@/lib/etiquette";

const DESKTOP = "(min-width: 48rem)";

/**
 * Où ouvrir une feuille du feed. Sur mobile, `fixed` : le portail la sort
 * du fil et la pose AU-DESSUS de la barre d'onglets (sinon le champ et
 * les boutons du bas passaient dessous, et un glissement sur le voile
 * faisait défiler le fil). Dès md, plus de barre d'onglets : la feuille
 * reste dans la carte (`absolute`).
 */
export function useFeedSheetContainer(): "fixed" | "absolute" {
  const desktop = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  return desktop ? "absolute" : "fixed";
}

/** Les pièces d'un look, dans une feuille : les cartes du Marché. */
export function ShopTheLook({
  pieces,
  open,
  onOpenChange,
}: {
  pieces: DisplayItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const container = useFeedSheetContainer();

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      eyebrow="Les pièces du look"
      title={`${nPieces(pieces.length)} à chiner`}
      container={container}
    >
      <div className="grid grid-cols-2 gap-3 overflow-y-auto overscroll-contain px-5 py-4">
        {pieces.map((p, i) => (
          <ProductCard key={p.id} item={p} index={i} />
        ))}
      </div>

      {/* au-dessus de la barre d'onglets (feuille fixed) : seul l'indicateur
          d'accueil reste à dégager */}
      <p className="border-t border-bone/10 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-xs text-ash md:pb-5">
        Protection acheteur incluse · envoi Mondial Relay
      </p>
    </Sheet>
  );
}
