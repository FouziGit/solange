"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PageShell } from "@/components/ui/PageShell";
import { ProductCard } from "@/components/ui/ProductCard";
import { Avatar } from "@/components/chrome/Avatar";
import { AnimatePresence } from "motion/react";
import { invite, looks, me } from "@/lib/mock";
import { forSale, liked } from "@/lib/data";
import { EASE, compact, euro, gradientFor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { imgItem } from "@/lib/img";
import {
  Verified,
  Star,
  Pin,
  Crown,
  Share,
  Check,
} from "@/components/chrome/icons";

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

function ReferralCard() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context / denied) — stay silent,
      // the code is still visible for manual copy.
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.4, ease: EASE.luxe }}
      className="overflow-hidden"
      aria-label="Parrainage"
    >
      <div className="mt-6 rounded-3xl border border-bone/12 bg-coal/60 p-5 md:max-w-md">
        <p className="overline text-[9px] text-ash">Parrainage</p>
        <p className="mt-1 font-editorial text-2xl font-semibold text-bone">
          Invite, gagne.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ash">
          {invite.reward}.
        </p>

        {/* code + copy */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-bone/[0.05] p-1.5 pl-4">
          <span className="flex-1 select-all font-display text-[15px] font-bold tracking-[0.12em] text-bone">
            {invite.code}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copier le code de parrainage"
            data-cursor="link"
            className="inline-flex items-center gap-1.5 rounded-full bg-bone px-3.5 py-2 text-[13px] font-semibold text-ink transition-transform active:scale-95"
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copié
              </>
            ) : (
              "Copier le code"
            )}
          </button>
        </div>

        {/* reward ladder with pips */}
        <ol className="mt-5 space-y-3">
          {invite.steps.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-bone/25 font-display text-[11px] font-bold text-bone/80"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-bone">
                  {step.label}
                </span>
                <span className="block text-[12px] leading-relaxed text-ash">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-5 border-t border-bone/10 pt-3 text-[12px] text-ash">
          <span className="font-semibold text-bone tabular-nums">
            {invite.invited}
          </span>{" "}
          ami{invite.invited > 1 ? "s" : ""} déjà parrainé
          {invite.invited > 1 ? "s" : ""}.
        </p>
      </div>
    </motion.section>
  );
}

export default function ProfilPage() {
  const [tab, setTab] = useState<string>("vente");
  const [referral, setReferral] = useState(false);
  const { orders } = useStore();
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
            <h1 className="font-display text-4xl font-bold tracking-tight text-bone md:text-5xl">
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
          <button
            type="button"
            onClick={() => setReferral((r) => !r)}
            aria-expanded={referral}
            aria-label="Inviter des amis"
            data-cursor="link"
            className={`grid size-10 place-items-center rounded-full border transition-colors ${
              referral
                ? "border-bone bg-bone text-ink"
                : "border-bone/20 text-bone hover:bg-bone/10"
            }`}
          >
            <Share className="size-4" />
          </button>
        </div>
      </div>

      {/* referral / invite — toggled by the Share button above */}
      <AnimatePresence initial={false}>
        {referral && <ReferralCard />}
      </AnimatePresence>

      {/* stats */}
      <div className="mt-8 flex items-center justify-around rounded-2xl border border-bone/10 py-4 md:max-w-md">
        <Stat value={compact(me.followers)} label="Abonnés" />
        <span className="h-8 w-px bg-bone/10" />
        <Stat value={compact(me.following)} label="Abonnements" />
        <span className="h-8 w-px bg-bone/10" />
        <Stat value={String(me.sales)} label="Ventes" />
      </div>

      {/* mes commandes — populated by the checkout flow */}
      {orders.length > 0 && (
        <div className="mt-8 md:max-w-md">
          <p className="overline mb-3 text-[9px] text-ash">
            Mes commandes · {orders.length}
          </p>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="glass flex items-center gap-3 rounded-2xl p-2.5"
              >
                <span
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
                  style={{ background: gradientFor(o.item.id) }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgItem(o.item.id)}
                    alt={o.item.name}
                    className="size-full object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="overline text-[9px] text-ash">{o.item.brand}</p>
                  <p className="font-display truncate text-[14px] font-semibold tracking-tight text-bone">
                    {o.item.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ash">
                    {o.id} · carte •••• {o.last4}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-display text-sm font-bold tracking-tight text-bone">
                    {euro(o.total)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bone/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-bone/80">
                    <Check className="size-2.5" /> Payé
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="mt-4 mb-2 text-center">
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem("solange:onboarded");
            } catch {}
            location.reload();
          }}
          className="text-[12px] text-ash/70 underline-offset-4 transition-colors hover:text-bone hover:underline"
        >
          Déconnexion
        </button>
      </div>
    </PageShell>
  );
}
