"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { streams } from "@/lib/mock";
import { api } from "@/lib/api";
import { LogoMark } from "../chrome/Brandmark";
import { Bell, Play, Bag } from "../chrome/icons";
import type { FeedMode } from "./FeedModeShell";

const anyLive = streams.some((s) => s.live);

const MODES: { id: FeedMode; label: string; Icon: typeof Play }[] = [
  { id: "scroll", label: "Feed", Icon: Play },
  { id: "shop", label: "Boutique", Icon: Bag },
];

/**
 * Feed top bar:
 *   row 1  [live dot]  ·  logo  ·  [bell]
 *   row 2  interactive Scroll ↔ Boutique switch (sliding pill, not a dropdown)
 * The switch is the primary top-level navigation of the home experience — it
 * flips the whole screen between the video scroll and the shop feed.
 */
export function FeedTopBar({
  mode,
  onModeChange,
}: {
  mode: FeedMode;
  onModeChange: (m: FeedMode) => void;
}) {
  // Pastille non-lu sur les cloches : un seul fetch au montage,
  // silencieux si invité (401) ou en cas d'échec réseau.
  const [hasUnread, setHasUnread] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void api.notifications().then((res) => {
      if (!cancelled && res.ok && res.data.unread > 0) setHasUnread(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bellLabel = hasUnread ? "Notifications — non lues" : "Notifications";

  return (
    <header
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-4 md:px-8"
    >
      {/* row 1 — [live dot] · logo centered · [bell]. Hidden on md (SideNav
          carries the logo there). */}
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
          aria-label={bellLabel}
          className="pointer-events-auto relative grid size-11 place-items-center justify-self-end text-bone/85 transition-colors hover:text-bone"
        >
          <Bell className="size-[21px]" />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-bone"
            />
          )}
        </Link>
      </div>

      {/* row 2 — the interactive mode switch */}
      <div className="relative flex w-full items-center justify-center">
        <div
          role="tablist"
          aria-label="Mode : feed ou boutique"
          className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1"
        >
          {MODES.map(({ id, label, Icon }) => {
            const on = mode === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => onModeChange(id)}
                className="relative rounded-full px-4 py-1.5"
              >
                {on && (
                  <motion.span
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-full bg-bone"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className={`relative z-10 flex items-center gap-1.5 text-[13px] font-semibold tracking-wide transition-colors ${
                    on ? "text-ink" : "text-bone/70"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* desktop-only notifications action */}
        <Link
          href="/notifications"
          className="pointer-events-auto absolute right-0 hidden size-11 place-items-center text-bone/85 transition-colors hover:text-bone md:grid"
          aria-label={bellLabel}
        >
          <Bell className="size-[21px]" />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-bone"
            />
          )}
        </Link>
      </div>
    </header>
  );
}
