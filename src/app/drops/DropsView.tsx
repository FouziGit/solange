"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Drop } from "@/lib/mock";
import { catalogItem } from "@/lib/mock";
import { compact, composition, gradientFor } from "@/lib/utils";
import { Avatar } from "@/components/chrome/Avatar";
import { ProductCard } from "@/components/ui/ProductCard";
import { Verified } from "@/components/chrome/icons";

/** Full-bleed media tile reusing the ProductCard gradient recipe. */
function DropMedia({ seed, className }: { seed: string; className?: string }) {
  const c = composition(seed);
  return (
    <div className={`absolute inset-0 ${className ?? ""}`}>
      <div
        className="absolute inset-0"
        style={{ background: gradientFor(seed) }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(56% 46% at ${30 + (c.h % 40)}% 22%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 40%, transparent 64%)`,
          }}
        />
        <div
          className="absolute rounded-full opacity-60 blur-2xl"
          style={{
            width: "70%",
            height: "58%",
            left: `${c.fx1}%`,
            top: `${22 + (c.h % 22)}%`,
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 72%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div
          className="absolute inset-0"
          style={{ boxShadow: "inset 0 0 110px 26px rgba(0,0,0,0.55)" }}
        />
      </div>
    </div>
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
          <DropMedia seed={featured.seed} />

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
            {/* glass countdown pill */}
            <span className="glass rounded-full px-3 py-1.5 text-[12px] font-medium tabular-nums text-bone">
              Démarre dans 02:14:30
            </span>
          </div>

          {/* bottom content */}
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            {featured.collab && (
              <p className="overline text-[10px] text-bone/60">
                {featured.collab}
              </p>
            )}
            <h2 className="font-editorial mt-1 text-4xl font-semibold leading-[0.98] tracking-tight text-bone md:text-6xl">
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
              <Link
                href="/decouvrir"
                data-cursor="link"
                className="ml-auto rounded-full bg-bone px-5 py-2 text-xs font-semibold text-ink transition-transform active:scale-95"
              >
                Voir le drop
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* featured product grid */}
      <ProductRow ids={featured.productIds} />

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
                  <span className="rounded-full border border-bone/20 px-2.5 py-0.5 text-[11px] font-medium text-bone/70">
                    {d.startsIn}
                  </span>
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
