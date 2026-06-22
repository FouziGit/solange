"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PageShell } from "@/components/ui/PageShell";
import { ProductCard } from "@/components/ui/ProductCard";
import { Avatar } from "@/components/chrome/Avatar";
import { looks, me } from "@/lib/mock";
import { forSale, liked } from "@/lib/data";
import { EASE, compact, euro, gradientFor } from "@/lib/utils";
import { Verified, Star, Pin, Crown, Share } from "@/components/chrome/icons";

const tabs = [
  { key: "vente", label: "À vendre" },
  { key: "looks", label: "Looks" },
  { key: "aimes", label: "Aimés" },
] as const;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg font-bold text-bone tabular-nums">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ash">
        {label}
      </div>
    </div>
  );
}

export default function ProfilPage() {
  const [tab, setTab] = useState<string>("vente");
  const saleItems = forSale();
  const likedItems = liked();

  return (
    <PageShell>
      {/* hero */}
      <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
        <div className="relative">
          <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-bone/40 to-bone/10 blur-[2px]" />
          <Avatar
            name={me.name}
            seed={me.seed}
            className="relative size-28 text-6xl ring-2 ring-ink md:size-32"
          />
        </div>

        <div className="mt-4 md:ml-7 md:mt-0 md:flex-1">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <h1 className="font-editorial text-4xl font-semibold tracking-tight text-bone md:text-5xl">
              {me.name}
            </h1>
            {me.verified && <Verified className="size-5 text-bone" />}
          </div>
          <p className="mt-1 text-sm text-ash">@{me.handle}</p>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-bone/85 md:mx-0">
            {me.bio}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-[12px] text-ash md:justify-start">
            <span className="inline-flex items-center gap-1">
              <Pin className="size-3.5" /> {me.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star filled className="size-3.5 text-bone" /> {me.rating}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 md:mt-0">
          <Link
            href="/premium"
            className="inline-flex items-center gap-1.5 rounded-full bg-bone px-4 py-2 text-sm font-semibold text-ink transition-transform active:scale-95"
          >
            <Crown className="size-4" /> Premium
          </Link>
          <button className="grid size-10 place-items-center rounded-full border border-bone/20 text-bone transition-colors hover:bg-bone/10">
            <Share className="size-4" />
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="mt-8 flex items-center justify-around rounded-2xl border border-bone/10 py-4 md:max-w-md">
        <Stat value={compact(me.followers)} label="Abonnés" />
        <span className="h-8 w-px bg-bone/10" />
        <Stat value={compact(me.following)} label="Abonnements" />
        <span className="h-8 w-px bg-bone/10" />
        <Stat value={String(me.sales)} label="Ventes" />
      </div>

      {/* tabs */}
      <div
        role="tablist"
        aria-label="Sections du profil"
        className="mt-9 flex gap-1 border-b border-bone/10"
      >
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className="relative px-4 pb-3 text-sm font-medium transition-colors"
            >
              <span className={on ? "text-bone" : "text-ash hover:text-bone"}>
                {t.label}
              </span>
              {on && (
                <motion.span
                  layoutId="profil-tab"
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-bone"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* content */}
      <div className="mt-6">
        {tab === "looks" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {looks.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: EASE.luxe,
                  delay: Math.min(i * 0.05, 0.3),
                }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-bone/10"
                style={{ background: gradientFor(l.seed) }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(60% 50% at 50% 30%, rgba(255,255,255,0.12), transparent 62%)",
                  }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-editorial text-3xl font-semibold text-bone/85 transition-transform duration-700 group-hover:scale-110">
                    {l.title}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3 text-[11px] text-bone/80">
                  <span>@{l.creator.handle}</span>
                  <span className="tabular-nums">♡ {compact(l.likes)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {(tab === "vente" ? saleItems : likedItems).map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* footer line */}
      <p className="mt-10 text-center text-xs text-ash">
        Membre SOLANGE depuis 2026 · {euro(me.sales * 86)} de ventes cumulées
      </p>
    </PageShell>
  );
}
