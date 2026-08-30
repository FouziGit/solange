"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import type { ApiProduct } from "@/lib/api";
import { euro } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { useStore } from "@/lib/store";
import { LuxeMedia } from "./LuxeMedia";
import { Heart, Bag } from "../chrome/icons";

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
  const sold = isSold(item.id);
  const discount = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : 0;

  const onSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSave(item.id);
  };

  const card = (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl ring-1 ring-bone/10 ${
          item.span ? "aspect-[3/5]" : "aspect-[3/4]"
        }`}
      >
        {/* media (scales on hover) — quieter take on the KenBurns luxury still */}
        <LuxeMedia
          seed={item.seed}
          image={item.image ?? imgItem(item.id)}
          brand={item.brand}
          eager={index < 2}
          className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
        />

        {/* discount badge */}
        {discount > 0 && !sold && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-bone px-2 py-0.5 text-[11px] font-bold text-ink">
            −{discount}%
          </span>
        )}

        {/* save — separate control, expanded ~44px hit area */}
        <button
          type="button"
          onClick={onSave}
          data-cursor="link"
          aria-label="Enregistrer"
          aria-pressed={saved}
          className="absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-full glass text-bone transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-90"
        >
          <Heart filled={saved} className="size-4" />
        </button>

        {/* condition + quick-buy (achat masqué si vendu) */}
        <span className="absolute bottom-2.5 left-2.5 rounded-full glass px-2 py-0.5 text-[11px] font-medium tracking-wide text-bone/85">
          {item.condition}
        </span>
        {!sold && !item.member && (
          <span
            data-cursor="link"
            aria-hidden="true"
            className="absolute bottom-2.5 right-2.5 grid size-8 translate-y-2 place-items-center rounded-full bg-bone text-ink opacity-0 transition-all duration-300 before:absolute before:-inset-2 before:content-[''] group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Bag className="size-4" />
          </span>
        )}

        {/* état vendu — overlay sombre discret, la carte reste lisible */}
        {sold && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55">
            <span className="border border-bone/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-bone">
              Vendu
            </span>
          </span>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="overline text-[11px] text-ash">{item.brand}</p>
        <p className="mt-0.5 truncate text-sm text-bone">{item.name}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[15px] font-bold text-bone">
              {euro(item.priceEUR)}
            </span>
            {item.originalEUR && (
              <span className="text-[11px] text-ash line-through">
                {euro(item.originalEUR)}
              </span>
            )}
          </div>
          <span className="text-[11px] text-ash">T. {item.size}</span>
        </div>
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
          {sold ? (
            <span
              aria-disabled="true"
              className="mt-2 flex min-h-11 cursor-not-allowed items-center justify-center border border-bone/15 text-[12px] font-semibold text-bone/40"
            >
              Vendu
            </span>
          ) : (
            <Link
              href={`/messages?item=${item.id}`}
              data-cursor="link"
              aria-label={`Contacter le vendeur — ${item.brand} ${item.name}`}
              className="mt-2 flex min-h-11 items-center justify-center border border-bone/30 text-[12px] font-semibold text-bone transition-colors hover:bg-bone/10 active:scale-[0.98]"
            >
              Contacter
            </Link>
          )}
        </div>
      ) : (
        <Link
          href={`/article/${item.id}`}
          data-cursor="link"
          aria-label={`${item.brand} — ${item.name}`}
          className="block"
        >
          {card}
        </Link>
      )}
    </motion.article>
  );
}
