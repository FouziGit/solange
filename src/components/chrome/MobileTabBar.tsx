"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Home, Compass, Live, Plus, User, X } from "./icons";
import { streams } from "@/lib/mock";

type TabItem = {
  href: string;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  match: (p: string) => boolean;
  live?: boolean;
};

const anyLive = streams.some((s) => s.live);

const items: TabItem[] = [
  { href: "/", label: "Feed", Icon: Home, match: (p) => p === "/" },
  { href: "/live", label: "Live", Icon: Live, match: (p) => p.startsWith("/live"), live: anyLive },
  { href: "/decouvrir", label: "Découvrir", Icon: Compass, match: (p) => p.startsWith("/decouvrir") },
  { href: "/profil", label: "Profil", Icon: User, match: (p) => p.startsWith("/profil") },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const [composeOpen, setComposeOpen] = useState(false);

  // Close on Escape.
  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [composeOpen]);

  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 flex items-end justify-around px-6 pt-3 md:hidden">
        <div className="glass pointer-events-none absolute inset-x-3 bottom-3 top-1 rounded-[26px]" />

        {left.map(({ href, label, Icon, match, live }) => (
          <TabLink key={href} href={href} label={label} Icon={Icon} on={match(pathname)} live={live} />
        ))}

        <button
          type="button"
          aria-label="Créer"
          aria-haspopup="dialog"
          aria-expanded={composeOpen}
          onClick={() => setComposeOpen((v) => !v)}
          className="relative -mt-4 grid size-14 place-items-center rounded-full bg-bone text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)] transition-transform active:scale-90"
        >
          <Plus
            className={`size-7 transition-transform duration-300 ${composeOpen ? "rotate-45" : ""}`}
            strokeWidth={2.4}
          />
        </button>

        {right.map(({ href, label, Icon, match, live }) => (
          <TabLink key={href} href={href} label={label} Icon={Icon} on={match(pathname)} live={live} />
        ))}
      </nav>

      <AnimatePresence>
        {composeOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <motion.button
              type="button"
              aria-label="Fermer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setComposeOpen(false)}
              className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
            />
            <motion.div
              role="dialog"
              aria-label="Que voulez-vous créer ?"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="pb-safe absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-bone/15 bg-coal/95 px-5 pt-4 backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between pb-3">
                <p className="eyebrow text-sm text-bone">Créer</p>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone"
                  aria-label="Fermer"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mb-1 h-px bg-bone/10" />
              <Link
                href="/vendre"
                onClick={() => setComposeOpen(false)}
                className="flex items-center justify-between rounded-2xl px-2 py-4 transition-colors hover:bg-bone/10"
              >
                <span className="flex flex-col">
                  <span className="text-base font-semibold text-bone">
                    Déposer une pièce
                  </span>
                  <span className="text-[12px] text-ash">Mettre en vente</span>
                </span>
              </Link>
              <div className="h-px bg-bone/10" />
              <Link
                href="/creer"
                onClick={() => setComposeOpen(false)}
                className="flex items-center justify-between rounded-2xl px-2 py-4 transition-colors hover:bg-bone/10"
              >
                <span className="flex flex-col">
                  <span className="text-base font-semibold text-bone">
                    Créer un look
                  </span>
                  <span className="text-[12px] text-ash">Publier un édito</span>
                </span>
              </Link>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function TabLink({
  href,
  label,
  Icon,
  on,
  live,
}: {
  href: string;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  on: boolean;
  live?: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative z-10 flex flex-1 flex-col items-center gap-1 py-1.5"
    >
      <span className="relative">
        <Icon
          className={`size-[22px] transition-colors ${on ? "text-bone" : "text-ash"}`}
        />
        {live && (
          <span className="absolute -right-1 -top-0.5 flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-bone" />
          </span>
        )}
      </span>
      <span
        className={`text-[9px] font-medium tracking-wide transition-colors ${on ? "text-bone" : "text-ash/60"}`}
      >
        {label}
      </span>
      {on && (
        <motion.span
          layoutId="tab-active"
          className="absolute -top-0.5 h-1 w-1 rounded-full bg-bone"
        />
      )}
    </Link>
  );
}
