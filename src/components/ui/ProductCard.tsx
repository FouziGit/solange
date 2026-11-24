"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import type { ApiProduct } from "@/lib/api";
import { libellePiece } from "@/lib/etiquette";
import { cn, euro } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { useStore } from "@/lib/store";
import {
  packageSizeOf,
  shippingFromCents,
  type PackageSizeId,
} from "@/lib/shipping";
import { Etiquette } from "./Etiquette";
import { LuxeMedia } from "./LuxeMedia";
import { Bookmark } from "../chrome/icons";

/**
 * CatalogItem élargi pour les surfaces de vente :
 * - `image`  : photo réelle uploadée (annonce membre) — prioritaire sur le
 *   visuel dérivé du seed.
 * - `member` : annonce membre (backend). Pas de page détail SSG en beta →
 *   la carte ne lie pas vers /article/[id], le CTA est « Contacter ».
 */
export type DisplayItem = CatalogItem & {
  image?: string;
  member?: boolean;
  /** Vendu d'après la donnée SOURCE (ex. profil public d'un membre) —
      complété par isSold() du store, qui ne voit que le flux global. */
  soldBase?: boolean;
  /** Quelqu'un est en train de payer la pièce (30 min au plus). */
  reserved?: boolean;
  /** Annonce du membre connecté : on ne s'achète pas soi-même. */
  mine?: boolean;
  /** Taille du colis figée au dépôt : fixe le port payé par l'acheteur. */
  packageSize?: PackageSizeId;
};

/** Mappe une annonce membre (ApiProduct) vers l'affichage catalogue existant. */
export function toDisplayItem(p: ApiProduct): DisplayItem {
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    priceEUR: p.priceEUR,
    size: p.size,
    condition: p.condition,
    seed: p.seed,
    category: p.category as CatalogItem["category"],
    seller: p.seller,
    likes: p.likes,
    image: p.images[0],
    member: true,
    soldBase: p.status === "sold",
    reserved: p.status === "reserved",
    mine: p.mine === true,
    packageSize: packageSizeOf(p.packageSize),
  };
}

/** Tri annonces membres : disponibles d'abord, puis plus récentes en tête. */
export function sortMemberProducts(products: ApiProduct[]): ApiProduct[] {
  return [...products].sort((a, b) =>
    a.status === b.status
      ? b.createdAt - a.createdAt
      : a.status === "available"
        ? -1
        : 1,
  );
}

export function ProductCard({
  item,
  index = 0,
}: {
  item: DisplayItem;
  index?: number;
}) {
  const { isSaved, toggleSave, isSold } = useStore();
  const saved = isSaved(item.id);
  const sold = item.soldBase || isSold(item.id);

  const onSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSave(item.id);
  };

  /* Rien n'est posé sur la photo, à part Garder. Taille, prix et « Vendue »
     vivent dans l'étiquette collée dessous (DA §9). */
  const card = (
    <>
      <div
        className={`relative overflow-hidden ${
          item.span ? "aspect-[3/5]" : "aspect-[3/4]"
        }`}
      >
        {/* media (scales on hover) — quieter take on the KenBurns luxury still ;
            vendue : la photo seule s'efface, pas le bouton Garder */}
        <LuxeMedia
          seed={item.seed}
          image={item.image ?? item.images?.[0] ?? imgItem(item.id)}
          brand={item.brand}
          alt=""
          eager={index < 2}
          className={cn(
            "transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]",
            sold && "opacity-40",
          )}
        />

        {/* save — separate control, expanded ~44px hit area */}
        <button
          type="button"
          onClick={onSave}
          data-cursor="link"
          aria-label={`Garder ${item.brand} ${item.name}`}
          aria-pressed={saved}
          className="absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full glass text-bone transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-90"
        >
          <Bookmark filled={saved} className="size-4" />
        </button>
      </div>

      <Etiquette variant={sold ? "vendue" : "carte"} item={item} />

      <div className="mt-2 px-0.5">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-bone">
          {item.brand}
        </p>
        <p className="mt-0.5 truncate text-[13.5px] text-bone">{item.name}</p>
        <p className="mt-0.5 text-[12px] text-ash">{item.condition}</p>
        {/* port de l'annonce membre : grille × taille figée, relais */}
        {item.member && !sold && (
          <p className="mt-0.5 text-[11px] text-ash">
            + envoi dès{" "}
            {euro(shippingFromCents(packageSizeOf(item.packageSize)) / 100)}
          </p>
        )}
      </div>
    </>
  );

  return (
    <motion.article
      /* Premier viewport : naît visible (LCP) — la révélation au scroll ne
         concerne que la suite de la grille. */
      initial={index < 4 ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index * 0.04, 0.4),
      }}
      whileHover={{ y: -4 }}
      className="group mb-3 break-inside-avoid"
    >
      {item.member ? (
        /* Annonce membre : pas de page détail en beta — contact direct. */
        <div className="block">
          {card}
          {/* vendue : l'étiquette le dit, rien à ajouter dessous */}
          {sold ? null : item.reserved ? (
            <span
              aria-disabled="true"
              className="mt-2 flex min-h-11 items-center justify-center border border-bone/15 text-[12px] font-semibold text-ash"
            >
              Paiement en cours
            </span>
          ) : item.mine ? (
            <span className="mt-2 flex min-h-11 items-center justify-center border border-bone/15 text-[12px] text-ash">
              Ta pièce
            </span>
          ) : (
            /* Une annonce membre n'avait qu'un bouton « Contacter » : il n'y
               avait AUCUN moyen de l'acheter. C'était le premier blocage de
               l'audit. Acheter passe devant, parler reste possible. */
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
              <Link
                href={`/checkout/${item.id}`}
                data-cursor="link"
                aria-label={`Acheter — ${item.brand} ${item.name}`}
                className="flex min-h-11 items-center justify-center bg-bone text-[12px] font-semibold text-ink transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                Acheter
              </Link>
              <Link
                href={`/messages?item=${item.id}`}
                data-cursor="link"
                aria-label={`Contacter le vendeur — ${item.brand} ${item.name}`}
                className="flex min-h-11 items-center justify-center border border-bone/30 px-3 text-[12px] font-semibold text-bone transition-colors hover:bg-bone/10 active:scale-[0.98]"
              >
                Contacter
              </Link>
            </div>
          )}
        </div>
      ) : (
        <Link
          href={`/article/${item.id}`}
          data-cursor="link"
          /* le nom remplace le contenu du lien : il redit taille et prix */
          aria-label={`${item.brand} — ${item.name}, ${libellePiece(
            sold ? { size: item.size } : item,
          )}`}
          className="block"
        >
          {card}
        </Link>
      )}
    </motion.article>
  );
}
