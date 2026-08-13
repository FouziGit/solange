"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { feedTabs, streams } from "@/lib/mock";
import { LogoMark } from "../chrome/Brandmark";
import { Bell } from "../chrome/icons";

const anyLive = streams.some((s) => s.live);

/**
 * Feed top bar — ONE quiet row, sized for 375px:
 *   [logo · live-dot]  ——  Pour vous | Abonnements  ——  [bell]
 * No search here (the Marché tab owns discovery), no hanging badges, and the
 * whole row sits under the notch via safe-area padding. Tabs are a real ARIA
 * tablist. Controlled when `tab`/`onTabChange` are supplied.
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
    <header
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center gap-1.5 px-4 md:px-8"
    >
      {/* row 1 — [live dot] · logo centered · [bell]. A 3-col grid keeps the
          brandmark optically centred whatever the side icons do. Hidden on md:
          the desktop SideNav already carries the logo. */}
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center md:hidden">
        <div className="flex items-center justify-self-start">
          {anyLive && (
            <Link
              href="/live"
              aria-label="Voir les lives en cours"
              className="pointer-events-auto relative grid size-11 place-items-center"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-bone" />
              </span>
            </Link>
          )}
        </div>

        <Link
          href="/"
          aria-label="SOLANGE — accueil"
          className="pointer-events-auto justify-self-center"
        >
          <LogoMark variant="white" className="size-7" />
        </Link>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="pointer-events-auto grid size-11 place-items-center justify-self-end text-bone/85 transition-colors hover:text-bone"
        >
          <Bell className="size-[21px]" />
        </Link>
      </div>

      {/* row 2 — feed tabs (also the whole bar on desktop). On md the bell
          returns to the right so no action is lost. */}
      <div className="relative flex w-full items-center justify-center">
        <nav
          role="tablist"
          aria-label="Filtrer le feed"
          className="pointer-events-auto flex items-center gap-6"
        >
          {feedTabs.map((t) => {
            const on = current === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className="relative whitespace-nowrap py-2 text-[13.5px] tracking-wide transition-colors"
              >
                <span
                  className={
                    on
                      ? "font-semibold text-bone"
                      : "font-medium text-bone/55 hover:text-bone/80"
                  }
                >
                  {t}
                </span>
                {on && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute -bottom-0.5 left-1/2 h-px w-6 -translate-x-1/2 bg-bone"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* desktop-only notifications action, kept out of the mobile row */}
        <Link
          href="/notifications"
          className="pointer-events-auto absolute right-0 hidden size-11 place-items-center text-bone/85 transition-colors hover:text-bone md:grid"
          aria-label="Notifications"
        >
          <Bell className="size-[21px]" />
        </Link>
      </div>
    </header>
  );
}
