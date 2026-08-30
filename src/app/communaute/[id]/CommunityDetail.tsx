"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { type Community } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TogglePill } from "@/components/ui/TogglePill";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified, Users, Comment, Check } from "@/components/chrome/icons";
import { compact } from "@/lib/utils";

/**
 * Fiche d'un cercle — tout ce que la carte de liste ne montre pas : à propos,
 * animateur, thématiques, fil de discussions. On y arrive en un tap depuis
 * la liste ; c'est ici, pas avant, que le cercle se dévoile en entier.
 */
export function CommunityDetail({ community: c }: { community: Community }) {
  const { isJoined, toggleJoin } = useStore();
  const joined = isJoined(c.id);

  return (
    <PageShell marginWord={c.name}>
      <PageHeader back="/communaute" eyebrow="Cercle" title={c.name} />

      <div className="flex items-start gap-4">
        <Avatar name={c.name} seed={c.seed} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-bone/90">{c.tagline}</p>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-ash">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" /> {compact(c.members)} membres
            </span>
            <span className="flex items-center gap-1.5">
              <Comment className="size-3.5" /> {compact(c.posts)} discussions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-bone" />
              </span>
              {compact(c.online)} en ligne
            </span>
          </div>
        </div>
      </div>

      <TogglePill
        on={joined}
        onToggle={() => toggleJoin(c.id)}
        labelOn="Rejoint"
        labelOff="Rejoindre le cercle"
        iconOn={<Check className="size-4" />}
        className="mt-5 w-full md:w-auto md:px-8"
      />

      <p className="mt-6 max-w-md text-[13.5px] leading-relaxed text-bone/80">
        {c.about}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.topics.map((t) => (
          <span
            key={t}
            className="border border-bone/20 px-2.5 py-1 text-[11px] font-medium text-bone/70"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2.5 border-t border-bone/10 pt-5">
        <Avatar name={c.host.name} seed={c.host.seed} className="size-9" />
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1 truncate text-[13px] font-semibold text-bone">
            {c.host.name}
            {c.host.verified && (
              <Verified className="size-3.5 shrink-0 text-bone" />
            )}
          </p>
          <p className="overline text-[10px] text-ash">Animé par</p>
        </div>
      </div>

      <p className="overline mt-8 mb-3 text-[11px] text-bone/50">À la une</p>
      <div className="flex flex-col gap-2">
        {c.threads.map((t, i) => (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
              delay: Math.min(i * 0.05, 0.3),
            }}
            className="flex gap-3 border border-bone/10 p-3.5"
          >
            <Avatar name={t.author} seed={t.seed} className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-bone">
                {t.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ash">
                {t.excerpt}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-[11px] text-ash/80">
                <span>@{t.handle}</span>
                <span className="size-0.5 rounded-full bg-ash" />
                <span>{t.replies} réponses</span>
                <span className="size-0.5 rounded-full bg-ash" />
                <span>{t.time}</span>
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <Link
        href="/communaute"
        className="mt-8 inline-block text-[12.5px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
      >
        ← Tous les cercles
      </Link>
    </PageShell>
  );
}
