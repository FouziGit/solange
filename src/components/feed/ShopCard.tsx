/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { euro, compact, gradientFor, initials } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import type { DisplayItem } from "../ui/ProductCard";
import { Heart, Bookmark, Share, Bag } from "../chrome/icons";
import { RailAction } from "./RailAction";

/**
 * Full-screen shoppable product card — the Vinted-in-TikTok side of the feed.
 * Same immersive format as a look (snap, full-bleed), but the content is a
 * single catalog piece: photo, price, size, condition, seller, buy CTA.
 * Accepte aussi les annonces membres (item.image + item.member) : photo réelle,
 * CTA « Contacter » au lieu d'un checkout, badge « Vendu » quand c'est parti.
 */
export function ShopCard({
  item,
  index,
}: {
  item: DisplayItem;
  index: number;
}) {
  const { isLiked, toggleLike, isSaved, toggleSave, isSold } = useStore();
  const liked = isLiked(item.id);
  const saved = isSaved(item.id);
  const sold = isSold(item.id);
  const [imgOk, setImgOk] = useState(true);
  // Photo réelle (annonce membre) prioritaire ; sinon visuel par seed.
  const src = item.image ?? imgItem(item.id);
  const off = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : null;

  return (
    <section
      data-index={index}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      <div
        className="relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-stage md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
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
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.4]"
            />
            <img
              src={src}
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

        {/* état vendu — overlay sombre sur la photo, sous l'info et le rail */}
        {sold && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/55">
            <span className="border border-bone/60 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-widest text-bone">
              Vendu
            </span>
          </div>
        )}

        {/* discount badge — top-left, under the top bar */}
        {off !== null && off > 0 && !sold && (
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
          <RailAction
            label={compact(item.likes + (liked ? 1 : 0))}
            onClick={() => toggleLike(item.id)}
            pressed={liked}
            ariaLabel={liked ? "Retirer le j'aime" : "J'aime"}
          >
            <Heart filled={liked} className="size-6 text-bone" />
          </RailAction>
          <RailAction
            label={saved ? "Gardé" : "Garder"}
            onClick={() => toggleSave(item.id)}
            pressed={saved}
            ariaLabel={saved ? "Retirer des favoris" : "Enregistrer"}
          >
            <Bookmark filled={saved} className="size-6 text-bone" />
          </RailAction>
          <RailAction label="Partager" ariaLabel="Partager">
            <Share className="size-[22px] text-bone" />
          </RailAction>
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
            {sold ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap bg-bone/25 px-6 py-2.5 text-sm font-semibold text-bone/50"
              >
                <Bag className="size-4" /> Vendu
              </button>
            ) : item.member ? (
              /* Annonce membre : pas de page détail/checkout en beta. */
              <Link
                href={`/messages?item=${item.id}`}
                data-cursor="link"
                className="flex items-center gap-2 whitespace-nowrap bg-bone px-6 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95"
              >
                Contacter
              </Link>
            ) : (
              <Link
                href={`/checkout/${item.id}`}
                data-cursor="link"
                className="flex items-center gap-2 whitespace-nowrap bg-bone px-6 py-2.5 text-sm font-semibold text-ink transition-transform active:scale-95"
              >
                <Bag className="size-4" /> Acheter
              </Link>
            )}
            <button
              type="button"
              disabled={sold}
              className="whitespace-nowrap border border-bone/30 px-4 py-2.5 text-sm font-medium text-bone transition-colors hover:bg-bone/10 active:scale-95 disabled:cursor-not-allowed disabled:border-bone/15 disabled:text-bone/40"
            >
              Faire une offre
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
