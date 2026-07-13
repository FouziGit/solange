"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { feedTabs, streams } from "@/lib/mock";
import { LogoMark } from "../chrome/Brandmark";
import { Search, Bell } from "../chrome/icons";

const anyLive = streams.some((s) => s.live);

/**
 * Feed top bar. Controlled when `tab`/`onTabChange` are supplied (VideoFeed
 * lifts the state so it can filter the feed); falls back to local state when
 * rendered standalone. Tabs are a real ARIA tablist.
 */
export function FeedTopBar({
  tab,
  onTabChange,
}: {
  tab?: string;
  onTabChange?: (tab: string) => void;
} = {}) {
  const [localTab, setLocalTab] = useState<string>(feedTabs[0]);
  const current = tab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-5 md:px-8 md:pt-6">
      {/* brand — mobile only (desktop has the side rail, which owns Live) */}
      <div className="pointer-events-auto relative md:invisible">
        <LogoMark variant="white" className="size-8" />
        {anyLive && (
          <Link
            href="/live"
            className="absolute left-0 top-full mt-3 flex h-7 items-center gap-1.5 whitespace-nowrap border border-bone/25 bg-ink/50 px-2.5 backdrop-blur-sm before:absolute before:-inset-x-2 before:-inset-y-2.5 before:content-['']"
            aria-label="Voir les lives en cours"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-bone" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bone">
              En direct
            </span>
          </Link>
        )}
      </div>

      {/* tabs */}
      <nav
        role="tablist"
        aria-label="Filtrer le feed"
        className="pointer-events-auto glass absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-none p-1"
      >
        {feedTabs.map((t) => {
          const on = current === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t)}
              className="relative whitespace-nowrap rounded-none px-4 py-1.5 text-[13px] font-semibold transition-colors"
            >
              {on && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-none bg-bone"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span
                className={`relative ${on ? "text-ink" : "text-bone/70 hover:text-bone"}`}
              >
                {t}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/notifications"
          className="grid size-10 place-items-center rounded-none glass text-bone"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
        </Link>
        <Link
          href="/decouvrir"
          className="grid size-10 place-items-center rounded-none glass text-bone"
          aria-label="Rechercher"
        >
          <Search className="size-5" />
        </Link>
      </div>
    </header>
  );
}
