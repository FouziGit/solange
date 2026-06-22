"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { SMark } from "./Brandmark";
import { Avatar } from "./Avatar";
import { Home, Compass, Plus, Chat, Heart, Bell } from "./icons";

const items = [
  { href: "/", label: "Feed", Icon: Home, match: (p: string) => p === "/" },
  { href: "/decouvrir", label: "Découvrir", Icon: Compass, match: (p: string) => p.startsWith("/decouvrir") },
  { href: "/favoris", label: "Favoris", Icon: Heart, match: (p: string) => p.startsWith("/favoris") },
  { href: "/messages", label: "Messages", Icon: Chat, match: (p: string) => p.startsWith("/messages") },
  { href: "/notifications", label: "Alertes", Icon: Bell, match: (p: string) => p.startsWith("/notifications") },
];

export function SideNav() {
  const pathname = usePathname();
  const [composeOpen, setComposeOpen] = useState(false);
  const composeRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!composeOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!composeRef.current?.contains(e.target as Node)) setComposeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposeOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [composeOpen]);

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[88px] flex-col items-center justify-between border-r border-bone/10 bg-ink/70 py-7 backdrop-blur-xl md:flex">
      <Link
        href="/"
        className="grid size-11 place-items-center rounded-full bg-bone text-ink transition-transform duration-300 hover:scale-110"
        aria-label="Accueil"
      >
        <SMark className="size-6" />
      </Link>

      <nav className="flex flex-1 flex-col items-center justify-center gap-2">
        {items.map(({ href, label, Icon, match }) => {
          const on = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className="group relative flex w-[72px] flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors"
            >
              {on && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-2xl bg-bone/[0.06] ring-1 ring-bone/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              {on && (
                <motion.span
                  layoutId="nav-dot"
                  className="absolute -left-[18px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-bone"
                />
              )}
              <Icon
                className={`relative size-[22px] transition-all duration-300 group-hover:-translate-y-0.5 ${
                  on ? "text-bone" : "text-ash group-hover:text-bone"
                }`}
              />
              <span
                className={`relative text-[10px] font-medium tracking-wide transition-colors ${
                  on ? "text-bone" : "text-ash/70 group-hover:text-bone"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <div ref={composeRef} className="relative mt-2">
          <button
            type="button"
            aria-label="Créer"
            aria-haspopup="menu"
            aria-expanded={composeOpen}
            onClick={() => setComposeOpen((v) => !v)}
            className="group grid size-12 place-items-center rounded-full bg-bone text-ink shadow-[0_6px_24px_-8px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:scale-110 active:scale-95"
          >
            <Plus
              className={`size-6 transition-transform duration-300 ${composeOpen ? "rotate-45" : ""}`}
              strokeWidth={2.4}
            />
          </button>

          <AnimatePresence>
            {composeOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, x: -6, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                className="glass-bone absolute left-[calc(100%+14px)] top-1/2 z-50 w-44 -translate-y-1/2 overflow-hidden rounded-2xl p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]"
              >
                <Link
                  href="/vendre"
                  role="menuitem"
                  onClick={() => setComposeOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-bone/10"
                >
                  <span className="text-sm font-semibold text-bone">
                    Déposer une pièce
                  </span>
                  <span className="text-[11px] text-ash">Mettre en vente</span>
                </Link>
                <Link
                  href="/creer"
                  role="menuitem"
                  onClick={() => setComposeOpen(false)}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-bone/10"
                >
                  <span className="text-sm font-semibold text-bone">
                    Créer un look
                  </span>
                  <span className="text-[11px] text-ash">Publier un édito</span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <Link href="/profil" className="group relative" aria-label="Mon profil">
        <span className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-bone to-bone/40 opacity-70 blur-[1px] transition-opacity group-hover:opacity-100" />
        <Avatar name="Nouh B" seed="solange-me-01" className="relative size-10 text-lg" />
      </Link>
    </aside>
  );
}
