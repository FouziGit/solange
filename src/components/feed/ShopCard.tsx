/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import type { CatalogItem } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { euro, compact, gradientFor, initials } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { Heart, Bookmark, Share, Bag } from "../chrome/icons";

/**
 * Full-screen shoppable product card — the Vinted-in-TikTok side of the feed.
 * Same immersive format as a look (snap, full-bleed), but the content is a
 * single catalog piece: photo, price, size, condition, seller, buy CTA.
 */
export function ShopCard({ item, index }: { item: CatalogItem; index: number }) {
  const { isLiked, toggleLike, isSaved, toggleSave } = useStore();
  const liked = isLiked(item.id);
  const saved = isSaved(item.id);
  const [imgOk, setImgOk] = useState(true);
  const off = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : null;

  return (
    <section
      data-index={index}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      <div
        className="relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-[30px] md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
        style={{ background: gradientFor(item.seed) }}
      >
        {/* gradient + monogram fallback (shows if the photo is missing) */}
        <span className="absolute inset-0 grid place-items-center">
          <span className="font-display text-[7rem] font-black text-bone/10">
            {initials(item.brand)}
          </span>
        </span>

        {imgOk && (
          <>
            {/* blurred fill so portrait product shots aren't hard-cropped */}
            <img
              src={imgItem(item.id)}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.4]"
            />
            <img
              src={imgItem(item.id)}
              alt={`${item.brand} — ${item.name}`}
              draggable={false}
              loading={index < 2 ? "eager" : "lazy"}
              onError={() => setImgOk(false)}
              className="absolute inset-0 size-full object-contain"
            />
          </>
        )}

        {/* legibility scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

        {/* discount badge — top-left, under the top bar */}
        {off !== null && off > 0 && (
          <span
            style={{ top: "calc(env(safe-area-inset-top) + 6.75rem)" }}
            className="absolute left-4 z-20 bg-bone px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink"
          >
            −{off}%
          </span>
        )}

        {/* action rail — like / save / share */}
        <div
          style={{ bottom: "calc(var(--tabbar-clearance) + 9rem)" }}
          className="absolute right-3 z-20 flex flex-col items-center gap-5 md:!bottom-40"
        >
          <RailButton
            label={compact(item.likes + (liked ? 1 : 0))}
            onClick={() => toggleLike(item.id)}
            pressed={liked}
            ariaLabel={liked ? "Retirer le j'aime" : "J'aime"}
          >
            <Heart filled={liked} className="size-6 text-bone" />
          </RailButton>
          <RailButton
            label={saved ? "Gardé" : "Garder"}
            onClick={() => toggleSave(item.id)}
            pressed={saved}
            ariaLabel={saved ? "Retirer des favoris" : "Enregistrer"}
          >
            <Bookmark filled={saved} className="size-6 text-bone" />
          </RailButton>
          <RailButton label="Partager" ariaLabel="Partager">
            <Share className="size-[22px] text-bone" />
          </RailButton>
        </div>

        {/* bottom info + buy CTA */}
        <div
          style={{ paddingBottom: "calc(var(--tabbar-clearance) + 1rem)" }}
          className="absolute inset-x-0 bottom-0 z-20 space-y-2.5 p-4 pr-20 md:!pb-9"
        >
          <p className="overline text-[10px] text-bone/70">{item.brand}</p>
          <p className="font-display max-w-[24ch] text-[16px] font-semibold leading-snug tracking-tight text-bone">
            {item.name}
          </p>

          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-black tracking-mega text-bone">
              {euro(item.priceEUR)}
            </span>
            {item.originalEUR && (
              <span className="text-[13px] text-ash line-through">
                {euro(item.originalEUR)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-bone/25 px-2.5 py-1 text-[11px] font-medium text-bone/80">
              Taille {item.size}
            </span>
            <span className="border border-bone/25 px-2.5 py-1 text-[11px] font-medium text-bone/80">
              {item.condition}
            </span>
          </div>

          <p className="text-[11px] text-ash">
            Vendu par <span className="text-bone/80">@{item.seller}</span> ·
            protection acheteur incluse
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/checkout/${item.id}`}
              data-cursor="link"
              className="flex items-center gap-2 whitespace-nowrap bg-bone px-6 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95"
            >
              <Bag className="size-4" /> Acheter
            </Link>
            <button
              type="button"
              className="whitespace-nowrap border border-bone/30 px-4 py-2.5 text-sm font-medium text-bone transition-colors hover:bg-bone/10 active:scale-95"
            >
              Faire une offre
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function RailButton({
  children,
  label,
  onClick,
  pressed,
  ariaLabel,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-cursor="link"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1"
    >
      <motion.span
        whileTap={{ scale: 0.8 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className="glass grid size-12 place-items-center rounded-full transition-colors group-hover:bg-bone/15"
      >
        {children}
      </motion.span>
      <span className="text-[11px] font-semibold tabular-nums text-bone/90">
        {label}
      </span>
    </button>
  );
}
