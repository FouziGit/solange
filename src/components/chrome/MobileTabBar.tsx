"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import {
  dansMarche,
  dernierMessage,
  messageNonLu,
  sansBarreOnglets,
} from "@/lib/nav";
import { useStore } from "@/lib/store";
import { Sheet } from "../ui/Sheet";
import { motion } from "motion/react";
import {
  Home,
  Compass,
  Chat,
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
    match: dansMarche,
  },
  {
    href: "/messages",
    label: "Messages",
    Icon: Chat,
    match: (p) => p.startsWith("/messages"),
  },
  {
    href: "/profil",
    label: "Profil",
    Icon: User,
    match: (p) => p.startsWith("/profil"),
  },
];

const MESSAGES_VUS = "solange:messages-vus";

export function MobileTabBar() {
  const pathname = usePathname();
  const [composeOpen, setComposeOpen] = useState(false);
  const { circlesUnread, user } = useStore();
  const connecte = user !== null;
  const [messagesNonLus, setMessagesNonLus] = useState(false);
  const etaitSurMessages = useRef(false);

  /* Point de Messages : il s'éteint quand on lit (en entrant dans Messages
     comme en en sortant) et se rallume quand on reçoit. Rien pour un invité. */
  useEffect(() => {
    const surMessages = pathname.startsWith("/messages");
    const vu = surMessages || etaitSurMessages.current;
    etaitSurMessages.current = surMessages;
    if (!connecte) return;
    let cancelled = false;
    void api.notifications().then((res) => {
      if (!res.ok) return;
      const notifs = res.data.notifications;
      // ponytail: repère « vu » par appareil ; un vrai compteur de messages non lus demande le serveur (netlify/), hors chantier.
      let vuA = 0;
      try {
        /* écrit même si on est déjà reparti : ce qui a été vu l'a été */
        if (vu)
          localStorage.setItem(MESSAGES_VUS, String(dernierMessage(notifs)));
        else vuA = Number(localStorage.getItem(MESSAGES_VUS)) || 0;
      } catch {
        /* stockage bloqué : vuA reste à 0 */
      }
      if (!cancelled) setMessagesNonLus(!vu && messageNonLu(notifs, vuA));
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, connecte]);

  if (sansBarreOnglets(pathname)) return null;

  const left = items.slice(0, 2);
  const right = items.slice(2);
  // Les Cercles vivent sous Profil : c'est lui qui porte leur point.
  const points: Record<string, boolean> = {
    "/messages": connecte && messagesNonLus,
    "/profil": circlesUnread > 0,
  };

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
            badge={points[href]}
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
            badge={points[href]}
          />
        ))}
      </nav>

      <div className="md:hidden">
        <Sheet
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          eyebrow="Créer"
          title="Publier ou déposer"
          maxHeight="60%"
        >
          <div className="grid gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <ComposeOption
              href="/creer"
              Icon={Camera}
              title="Publier un look"
              hint="Photos et inspiration, sans vente."
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
  badge,
}: {
  href: string;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  on: boolean;
  live?: boolean;
  /** Non-lus (messages, Cercles) : point plein, calme — le ping reste au live. */
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
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
        {badge && !live && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-bone"
          />
        )}
      </span>
      {/* inactif en text-ash (≥ 4.5:1 sur la barre) ; l'actif se distingue
          aussi par la graisse et le point, pas par la seule couleur */}
      <span
        className={`text-[11px] tracking-wide transition-colors ${on ? "font-semibold text-bone" : "font-medium text-ash"}`}
      >
        {label}
      </span>
      {/* un aria-label sur un <span> n'est pas fiable : texte masqué */}
      {badge && !live && <span className="sr-only">, du nouveau</span>}
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
