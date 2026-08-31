"use client";

import { useMemo } from "react";
import { catalog } from "@/lib/mock";
import { useStore } from "@/lib/store";
import {
  sortMemberProducts,
  toDisplayItem,
  type DisplayItem,
} from "../ui/ProductCard";
import { ShopCard } from "./ShopCard";

/**
 * The "Boutique" side of the home feed: the same full-screen vertical snap as
 * the video scroll, but each screen is a shoppable catalog piece (Vinted-style
 * buy/sell in a TikTok format). Toggled from the top mode switch.
 * Les annonces membres (backend) passent en tête, disponibles d'abord.
 */
export function ShopFeed() {
  const { serverProducts } = useStore();

  const feed = useMemo<DisplayItem[]>(
    () => [
      ...sortMemberProducts(serverProducts).map(toDisplayItem),
      ...catalog,
    ],
    [serverProducts],
  );

  return (
    <div className="feed-scroll h-[100dvh] overflow-y-auto overflow-x-hidden">
      {feed.map((item, i) => (
        <ShopCard key={item.id} item={item} index={i} />
      ))}

      <div className="feed-snap flex h-[60dvh] flex-col items-center justify-center gap-3 px-10 text-center">
        <span className="etiquette text-[11px] text-bone/60">
          Fin de la sélection
        </span>
        <p className="max-w-[26ch] text-[12.5px] text-ash/80">
          Tu as tout vu. Remonte, ou explore le Marché complet.
        </p>
      </div>
    </div>
  );
}
