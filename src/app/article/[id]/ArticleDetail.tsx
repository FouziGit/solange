"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { compact, euro } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { track } from "@/lib/track";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/chrome/Avatar";
import { LuxeMedia } from "@/components/ui/LuxeMedia";
import { ProductCard } from "@/components/ui/ProductCard";
import { Chip } from "@/components/ui/Chip";
import { Bag, Heart, Send } from "@/components/chrome/icons";

export function ArticleDetail({
  item,
  similar,
}: {
  item: CatalogItem;
  similar: CatalogItem[];
}) {
  const { isSaved, toggleSave, isSold, likeCount } = useStore();
  const saved = isSaved(item.id);
  const sold = isSold(item.id);
  const [size, setSize] = useState(item.size);
  const discount = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : 0;

  // deterministic thumbnail variants off the base seed
  const thumbs = [`${item.seed}-a`, `${item.seed}-b`];

  return (
    <div>
      {/* two-column: media left, details right */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* LEFT — media */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl ring-1 ring-bone/10">
            <LuxeMedia
              seed={item.seed}
              brand={item.brand}
              image={imgItem(item.id)}
              eager
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {thumbs.map((t) => (
              <div
                key={t}
                className="relative aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-bone/10"
              >
                <LuxeMedia seed={t} brand={item.brand} small />
              </div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — details */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="lg:py-2"
        >
          <p className="text-[12px] text-ash">{item.brand}</p>
          <h1 className="font-editorial mt-2 text-5xl font-semibold leading-[0.95] tracking-tight text-bone md:text-7xl">
            {item.name}
          </h1>

          {/* price row */}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-bone">
              {euro(item.priceEUR)}
            </span>
            {item.originalEUR && (
              <span className="text-base text-ash line-through">
                {euro(item.originalEUR)}
              </span>
            )}
            {discount > 0 && (
              <span className="rounded-full bg-bone px-2 py-0.5 text-[11px] font-bold text-ink">
                −{discount}%
              </span>
            )}
            {/* scarcity pill */}
            <span className="rounded-full border border-bone/25 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-bone/70">
              Pièce unique
            </span>
            {/* compteur réel = base + likes membres agrégés serveur */}
            <span
              aria-label={`${likeCount(item.id, item.likes)} j'aime`}
              className="inline-flex items-center gap-1 text-[12px] text-ash"
            >
              <Heart className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">
                {compact(likeCount(item.id, item.likes))}
              </span>
            </span>
          </div>

          {/* size + condition pills */}
          <div className="mt-6">
            <p className="overline text-[11px] text-ash">Taille</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[item.size].map((s) => (
                <Chip key={s} active={size === s} onClick={() => setSize(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-bone/20 px-3 py-1 text-[12px] text-bone/70">
              {item.condition}
            </span>
            <span className="rounded-full border border-bone/20 px-3 py-1 text-[12px] text-bone/70">
              {item.category}
            </span>
          </div>

          {/* seller row — handle réel cliquable → profil public ; le lien
              messages reste porté par « Contacter le vendeur » */}
          <div className="glass mt-7 flex items-center gap-2 rounded-2xl p-2 pr-2.5">
            <Link
              href={`/membre/${encodeURIComponent(item.seller)}`}
              data-cursor="link"
              aria-label={`Voir le profil de @${item.seller}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-bone/10"
            >
              <Avatar
                name={item.seller}
                seed={item.seller}
                className="size-11 shrink-0 text-2xl ring-1 ring-bone/15"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-bone">
                  @{item.seller}
                </span>
                <span className="block text-[11px] text-ash">
                  Voir le profil
                </span>
              </span>
            </Link>
            <Link
              href={`/messages?item=${item.id}`}
              data-cursor="link"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-bone/25 px-4 text-center text-[12px] font-semibold leading-tight text-bone transition-colors hover:bg-bone/15"
            >
              <Send className="size-3.5 shrink-0" aria-hidden="true" />
              Contacter le vendeur
            </Link>
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {sold ? (
              <button
                type="button"
                disabled
                className="flex min-h-[52px] flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-none bg-bone/15 px-6 py-3.5 text-sm font-semibold text-bone/50"
              >
                <Bag className="size-5" />
                Vendu
              </button>
            ) : (
              <Link
                href={`/checkout/${item.id}`}
                onClick={() =>
                  track("checkout_start", {
                    id: item.id,
                    brand: item.brand,
                    priceEUR: item.priceEUR,
                  })
                }
                data-cursor="link"
                className="flex flex-1 items-center justify-center gap-2 rounded-none bg-bone px-6 py-3.5 text-sm font-semibold text-ink transition-transform active:scale-95"
              >
                <Bag className="size-5" />
                Acheter — {euro(item.priceEUR)}
              </Link>
            )}
            <Link
              href={`/messages?item=${item.id}`}
              data-cursor="link"
              className="glass flex items-center justify-center gap-2 rounded-none px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-bone/15"
            >
              <Send className="size-4" />
              Faire une offre
            </Link>
            <button
              type="button"
              onClick={() => toggleSave(item.id)}
              aria-label="Enregistrer"
              aria-pressed={saved}
              data-cursor="link"
              className="glass grid size-[52px] shrink-0 place-items-center rounded-none text-bone transition-transform active:scale-90"
            >
              <Heart filled={saved} className="size-5" />
            </button>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-ash">
            Protection acheteur (démo) — paiement simulé, aucune transaction
            réelle. Commission dégressive reversée au vendeur.
          </p>
        </motion.div>
      </div>

      {/* similar */}
      {similar.length > 0 && (
        <section className="mt-16 md:mt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone md:text-4xl">
              Pièces similaires
            </h2>
            <span className="hidden text-sm text-ash md:block">
              {similar.length} pièce{similar.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {similar.map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
