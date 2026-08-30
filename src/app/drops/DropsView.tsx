"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Drop } from "@/lib/mock";
import { catalogItem } from "@/lib/mock";
import { compact } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import { track } from "@/lib/track";
import { Avatar } from "@/components/chrome/Avatar";
import { LuxeMedia } from "@/components/ui/LuxeMedia";
import { ProductCard } from "@/components/ui/ProductCard";
import { Verified } from "@/components/chrome/icons";

/** Format a remaining-seconds count as a zero-padded HH:MM:SS string. */
function formatCountdown(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Live featured countdown. Ticks the Wave-A `secondsToStart` down once a second.
 * - secondsToStart === 0 → the drop is live, render the "EN DIRECT" label instead.
 * - reduced-motion → no interval, render the static initial value (no flicker).
 */
function FeaturedCountdown({ seconds }: { seconds: number }) {
  const reduce = useReducedMotion();
  const [remaining, setRemaining] = useState(seconds);

  // Subscribe to a 1 s ticker; cleared on unmount or when reduced-motion is on.
  // `seconds` is fixed for the featured drop, so initial state covers the static
  // (reduced-motion / live) cases without re-syncing inside the effect.
  useEffect(() => {
    if (seconds <= 0 || reduce) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, reduce]);

  return (
    <span className="glass rounded-full px-3 py-1.5 text-[12px] font-medium tabular-nums text-bone">
      Démarre dans {formatCountdown(remaining)}
    </span>
  );
}

/** Accessible "Me prévenir" toggle (role=switch). */
function NotifySwitch({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => setOn((v) => !v)}
      data-cursor="link"
      className="flex shrink-0 items-center gap-2"
    >
      <span className="hidden text-[11px] font-medium text-bone/70 sm:inline">
        Me prévenir
      </span>
      <span
        className={`relative h-6 w-11 rounded-full border transition-colors ${
          on ? "border-bone bg-bone" : "border-bone/25 bg-bone/[0.06]"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full ${
            on ? "right-1 bg-ink" : "left-1 bg-bone/70"
          }`}
        />
      </span>
    </button>
  );
}

function ProductRow({ ids }: { ids: string[] }) {
  const items = ids
    .map((id) => catalogItem(id))
    .filter((it): it is NonNullable<typeof it> => it !== undefined);
  if (items.length === 0) return null;
  return (
    <div className="mt-4 columns-2 gap-3 md:columns-3">
      {items.map((it, i) => (
        <ProductCard key={it.id} item={it} index={i} />
      ))}
    </div>
  );
}

export function DropsView({ drops }: { drops: Drop[] }) {
  const featured = drops.find((d) => d.badge === "LIVE") ?? drops[0];
  const upcoming = drops.filter((d) => d.id !== featured.id);

  const gridRef = useRef<HTMLDivElement>(null);
  const [reserved, setReserved] = useState(false);

  /** Scroll the featured product grid into view instead of leaving the page. */
  const seeDrop = () => {
    track("drop_view", { id: featured.id });
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reserve = () => {
    if (reserved) return;
    setReserved(true);
    track("drop_reserve", { id: featured.id });
  };

  return (
    <div>
      {/* ---- Featured live drop ---- */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[28px] ring-1 ring-bone/10"
      >
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10]">
          <LuxeMedia
            seed={featured.seed}
            image={imgItem(featured.productIds[0])}
            watermark={false}
            eager
          />

          {/* top badges */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
            {featured.badge === "LIVE" ? (
              <span className="flex items-center gap-2 rounded-full bg-bone/10 px-3 py-1 ring-1 ring-bone/40 backdrop-blur">
                <span className="relative grid place-items-center">
                  <span className="size-2 rounded-full bg-bone" />
                  <span className="absolute size-2 animate-ping rounded-full bg-bone/70" />
                </span>
                <span className="text-[11px] font-bold tracking-wider text-bone">
                  EN DIRECT
                </span>
              </span>
            ) : (
              <span className="rounded-full bg-bone/10 px-3 py-1 text-[11px] font-bold tracking-wider text-bone ring-1 ring-bone/30 backdrop-blur">
                {featured.badge}
              </span>
            )}
            {/* countdown — live when the drop is still upcoming, label when in direct */}
            {featured.secondsToStart > 0 ? (
              <FeaturedCountdown seconds={featured.secondsToStart} />
            ) : (
              <span className="glass rounded-full px-3 py-1.5 text-[12px] font-medium text-bone">
                Ouvert maintenant
              </span>
            )}
          </div>

          {/* bottom content */}
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            {featured.collab && (
              <p className="overline text-[11px] text-bone/60">
                {featured.collab}
              </p>
            )}
            <h2 className="font-editorial mt-1 text-5xl font-semibold leading-[0.95] tracking-tight text-bone md:text-7xl">
              {featured.title}
            </h2>

            {/* creator row */}
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                name={featured.creator.name}
                seed={featured.creator.seed}
                className="size-10 text-xl ring-1 ring-bone/20"
              />
              <div className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-bone">
                    @{featured.creator.handle}
                  </span>
                  {featured.creator.verified && (
                    <Verified className="size-4 shrink-0 text-bone" />
                  )}
                </span>
                <span className="block text-[11px] text-ash">
                  {compact(featured.creator.followers)} abonnés
                </span>
              </div>
              <button
                type="button"
                onClick={seeDrop}
                data-cursor="link"
                className="ml-auto rounded-full bg-bone px-5 py-2 text-xs font-semibold text-ink transition-transform active:scale-95"
              >
                Voir le drop
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* featured product grid */}
      <div ref={gridRef} className="scroll-mt-24">
        <div className="mt-6 flex items-center justify-between gap-4">
          <h2 className="font-editorial text-2xl font-semibold tracking-tight text-bone md:text-3xl">
            Pièces du drop
          </h2>
          <button
            type="button"
            onClick={reserve}
            data-cursor="link"
            aria-live="polite"
            className={`rounded-full px-5 py-2 text-xs font-semibold transition-transform active:scale-95 ${
              reserved
                ? "border border-bone/25 text-bone/70"
                : "bg-bone text-ink"
            }`}
          >
            {reserved ? "Place réservée ✓" : "Réserver ma place"}
          </button>
        </div>
        <ProductRow ids={featured.productIds} />
      </div>

      {/* ---- Upcoming drops ---- */}
      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone md:text-4xl">
            À venir
          </h2>
          <span className="hidden text-sm text-ash md:block">
            {upcoming.length} drop{upcoming.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {upcoming.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -8% 0px" }}
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
                delay: Math.min(i * 0.05, 0.3),
              }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={d.creator.name}
                  seed={d.creator.seed}
                  className="size-11 text-2xl ring-1 ring-bone/15"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-editorial truncate text-lg leading-tight text-bone">
                    {d.title}
                  </p>
                  <p className="truncate text-[12px] text-ash">
                    @{d.creator.handle}
                    {d.collab ? ` · ${d.collab}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {d.secondsToStart > 0 ? (
                    <FeaturedCountdown seconds={d.secondsToStart} />
                  ) : (
                    <span className="rounded-full border border-bone/20 px-2.5 py-0.5 text-[11px] font-medium text-bone/70">
                      {d.startsIn}
                    </span>
                  )}
                  <NotifySwitch label={`Me prévenir pour ${d.title}`} />
                </div>
              </div>
              <ProductRow ids={d.productIds} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
