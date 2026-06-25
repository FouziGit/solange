"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { euro } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { useStore } from "@/lib/store";
import { LuxeMedia } from "./LuxeMedia";
import { Heart, Bag } from "../chrome/icons";

export function ProductCard({
  item,
  index = 0,
}: {
  item: CatalogItem;
  index?: number;
}) {
  const { isSaved, toggleSave } = useStore();
  const saved = isSaved(item.id);
  const discount = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : 0;

  const onSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSave(item.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
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
      <Link
        href={`/article/${item.id}`}
        data-cursor="link"
        aria-label={`${item.brand} — ${item.name}`}
        className="block"
      >
        <div
          className={`relative overflow-hidden rounded-2xl ring-1 ring-bone/10 ${
            item.span ? "aspect-[3/5]" : "aspect-[3/4]"
          }`}
        >
          {/* media (scales on hover) — quieter take on the KenBurns luxury still */}
          <LuxeMedia
            seed={item.seed}
            image={imgItem(item.id)}
            brand={item.brand}
            className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
          />

          {/* discount badge */}
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-bone px-2 py-0.5 text-[10px] font-bold text-ink">
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
            className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full glass text-bone transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-90"
          >
            <Heart filled={saved} className="size-4" />
          </button>

          {/* condition + quick-buy */}
          <span className="absolute bottom-2.5 left-2.5 rounded-full glass px-2 py-0.5 text-[9px] font-medium tracking-wide text-bone/85">
            {item.condition}
          </span>
          <span
            data-cursor="link"
            aria-hidden="true"
            className="absolute bottom-2.5 right-2.5 grid size-8 translate-y-2 place-items-center rounded-full bg-bone text-ink opacity-0 transition-all duration-300 before:absolute before:-inset-2 before:content-[''] group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Bag className="size-4" />
          </span>
        </div>

        <div className="mt-2.5 px-0.5">
          <p className="overline text-[9px] text-ash">{item.brand}</p>
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
      </Link>
    </motion.article>
  );
}
