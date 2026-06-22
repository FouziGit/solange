"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { savedIds } from "@/lib/mock";
import { composition, euro, gradientFor } from "@/lib/utils";
import { Avatar } from "@/components/chrome/Avatar";
import { ProductCard } from "@/components/ui/ProductCard";
import { Chip } from "@/components/ui/Chip";
import { Bag, Heart, Send, Verified } from "@/components/chrome/icons";

/** Large media tile reusing the ProductCard gradient recipe. */
function MediaTile({
  seed,
  brand,
  className,
  small,
}: {
  seed: string;
  brand: string;
  className?: string;
  small?: boolean;
}) {
  const c = composition(seed);
  return (
    <div
      className={`relative overflow-hidden rounded-3xl ring-1 ring-bone/10 ${className ?? ""}`}
    >
      <div
        className="absolute inset-0"
        style={{ background: gradientFor(seed) }}
      >
        {/* top key-light */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(56% 46% at ${30 + (c.h % 40)}% 24%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 40%, transparent 64%)`,
          }}
        />
        {/* draped-light form */}
        <div
          className="absolute rounded-full opacity-60 blur-2xl"
          style={{
            width: "70%",
            height: "58%",
            left: `${c.fx1}%`,
            top: `${24 + (c.h % 22)}%`,
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 72%)",
          }}
        />
        {/* centered Didone brand watermark + hairline rule */}
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="flex flex-col items-center text-center">
            <span
              className={`font-editorial italic leading-tight text-bone/30 ${small ? "text-lg" : "text-3xl md:text-5xl"}`}
            >
              {brand}
            </span>
            <span className="mt-2 h-px w-8 bg-bone/25" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        {/* inset vignette */}
        <div
          className="absolute inset-0"
          style={{ boxShadow: "inset 0 0 90px 20px rgba(0,0,0,0.55)" }}
        />
      </div>
    </div>
  );
}

export function ArticleDetail({
  item,
  similar,
}: {
  item: CatalogItem;
  similar: CatalogItem[];
}) {
  const [saved, setSaved] = useState(() => savedIds.includes(item.id));
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
          <MediaTile
            seed={item.seed}
            brand={item.brand}
            className="aspect-[3/4]"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {thumbs.map((t) => (
              <MediaTile
                key={t}
                seed={t}
                brand={item.brand}
                className="aspect-[4/3]"
                small
              />
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
          <p className="overline text-[11px] text-ash">{item.brand}</p>
          <h1 className="font-editorial mt-2 text-4xl font-semibold leading-[1.02] tracking-tight text-bone md:text-5xl">
            {item.name}
          </h1>

          {/* price row */}
          <div className="mt-5 flex items-baseline gap-3">
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
          </div>

          {/* size + condition pills */}
          <div className="mt-6">
            <p className="overline text-[9px] text-ash">Taille</p>
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

          {/* seller row */}
          <Link
            href="/profil"
            data-cursor="link"
            className="glass mt-7 flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-bone/15"
          >
            <Avatar
              name={item.seller}
              seed={item.seller}
              className="size-11 text-2xl ring-1 ring-bone/15"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-bone">
                  @{item.seller}
                </span>
                <Verified className="size-4 shrink-0 text-bone" />
              </span>
              <span className="block text-[11px] text-ash">
                Vendeur vérifié · Voir la vitrine
              </span>
            </span>
          </Link>

          {/* actions */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              data-cursor="link"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-bone px-6 py-3.5 text-sm font-semibold text-ink transition-transform"
            >
              <Bag className="size-5" />
              Acheter — {euro(item.priceEUR)}
            </motion.button>
            <Link
              href="/messages"
              data-cursor="link"
              className="glass flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-bone/15"
            >
              <Send className="size-4" />
              Faire une offre
            </Link>
            <button
              type="button"
              onClick={() => setSaved((s) => !s)}
              aria-label="Enregistrer"
              aria-pressed={saved}
              data-cursor="link"
              className="glass grid size-[52px] shrink-0 place-items-center rounded-full text-bone transition-transform active:scale-90"
            >
              <Heart filled={saved} className="size-5" />
            </button>
          </div>

          <p className="mt-6 text-[13px] leading-relaxed text-ash">
            Pièce authentifiée par la communauté SOLANGE. Paiement sécurisé,
            retour sous 14 jours. Commission dégressive reversée au vendeur.
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
