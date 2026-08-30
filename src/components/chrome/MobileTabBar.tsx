"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Home,
  Compass,
  Users,
  Plus,
  User,
  X,
  Camera,
  Bag,
  ChevronRight,
} from "./icons";

type TabItem = {
  href: string;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  match: (p: string) => boolean;
  live?: boolean;
};

const items: TabItem[] = [
  { href: "/", label: "Feed", Icon: Home, match: (p) => p === "/" },
  {
    href: "/decouvrir",
    label: "Marché",
    Icon: Compass,
    match: (p) => p.startsWith("/decouvrir"),
  },
  {
    href: "/communaute",
    label: "Commu",
    Icon: Users,
    match: (p) => p.startsWith("/communaute"),
  },
  {
    href: "/profil",
    label: "Profil",
    Icon: User,
    match: (p) => p.startsWith("/profil"),
  },
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
        <div className="glass pointer-events-none absolute inset-x-3 bottom-3 top-1 rounded-none" />

        {left.map(({ href, label, Icon, match, live }) => (
          <TabLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            on={match(pathname)}
            live={live}
          />
        ))}

        <button
          type="button"
          aria-label="Créer"
          aria-haspopup="dialog"
          aria-expanded={composeOpen}
          onClick={() => setComposeOpen((v) => !v)}
          className="relative -mt-4 grid size-14 place-items-center rounded-full bg-bone text-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)] transition-transform active:scale-90"
        >
          <Plus
            className={`size-7 transition-transform duration-300 ${composeOpen ? "rotate-45" : ""}`}
            strokeWidth={2.4}
          />
        </button>

        {right.map(({ href, label, Icon, match, live }) => (
          <TabLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            on={match(pathname)}
            live={live}
          />
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
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div
              role="dialog"
              aria-label="Que voulez-vous créer ?"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="pb-safe absolute inset-x-0 bottom-0 rounded-t-stage border-t border-bone/15 bg-coal/95 px-5 pb-4 pt-5 backdrop-blur-2xl"
            >
              {/* grabber */}
              <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-bone/20" />

              <div className="mb-4 flex items-center justify-between">
                <p className="font-display text-lg font-bold uppercase tracking-tight text-bone">
                  Créer
                </p>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="grid size-9 place-items-center rounded-full bg-bone/10 text-bone transition-colors hover:bg-bone/20"
                  aria-label="Fermer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid gap-3">
                <ComposeOption
                  href="/creer"
                  Icon={Camera}
                  title="Publier du contenu"
                  hint="Photos, vidéos, inspiration"
                  onClick={() => setComposeOpen(false)}
                />
                <ComposeOption
                  href="/vendre"
                  Icon={Bag}
                  title="Vendre un article"
                  hint="Marque, taille, état, prix"
                  onClick={() => setComposeOpen(false)}
                />
              </div>
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

function ComposeOption({
  href,
  Icon,
  title,
  hint,
  onClick,
}: {
  href: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-bone/12 bg-bone/[0.03] p-3.5 transition-colors hover:border-bone/30 hover:bg-bone/[0.07]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-bone text-ink">
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[15px] font-bold uppercase tracking-tight text-bone">
          {title}
        </span>
        <span className="block text-[12px] text-ash">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ash transition-colors group-hover:text-bone" />
    </Link>
  );
}
