"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet } from "../ui/Sheet";
import { motion } from "motion/react";
import {
  Home,
  Compass,
  Users,
  Plus,
  User,
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
  { href: "/", label: "Looks", Icon: Home, match: (p) => p === "/" },
  {
    href: "/decouvrir",
    label: "Marché",
    Icon: Compass,
    match: (p) => p.startsWith("/decouvrir"),
  },
  {
    href: "/communaute",
    label: "Cercles",
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

  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 flex items-end justify-around px-6 pt-3 md:hidden">
        <div className="glass-bar pointer-events-none absolute inset-x-3 bottom-3 top-1 rounded-none" />

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

      <div className="md:hidden">
        <Sheet
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          eyebrow="Créer"
          title="Publier ou vendre"
          maxHeight="60%"
        >
          <div className="grid gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <ComposeOption
              href="/creer"
              Icon={Camera}
              title="Publier un look"
              hint="Photos, inspiration — sans vente"
              onClick={() => setComposeOpen(false)}
            />
            <ComposeOption
              href="/vendre"
              Icon={Bag}
              title="Déposer une pièce"
              hint="Marque, taille, état, prix"
              onClick={() => setComposeOpen(false)}
            />
          </div>
        </Sheet>
      </div>
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
        className={`text-[11px] font-medium tracking-wide transition-colors ${on ? "text-bone" : "text-ash/60"}`}
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
