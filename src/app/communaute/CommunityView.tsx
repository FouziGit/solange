"use client";

import { motion } from "motion/react";
import { communities, type Community } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified, Users, Comment, Check } from "@/components/chrome/icons";
import { compact, gradientFor, initials } from "@/lib/utils";

export function CommunityView() {
  const { isJoined } = useStore();
  const joinedCount = communities.filter((c) => isJoined(c.id)).length;

  return (
    <PageShell marginWord="Communauté">
      <PageHeader
        title="Communauté"
        subtitle="Rejoins des créateurs qui parlent mode, culture et archives — de l'impact des rappeurs sur le vestiaire aux pièces qui traversent les époques."
      />

      <p className="mb-6 text-[12.5px] text-ash">
        {joinedCount > 0
          ? `Tu fais partie de ${joinedCount} cercle${joinedCount > 1 ? "s" : ""}.`
          : "Tu ne suis encore aucun cercle. Rejoins-en un pour lancer la conversation."}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        {communities.map((c, i) => (
          <CommunityCard key={c.id} community={c} index={i} />
        ))}
      </div>
    </PageShell>
  );
}

function CommunityCard({
  community: c,
  index,
}: {
  community: Community;
  index: number;
}) {
  const { isJoined, toggleJoin } = useStore();
  const joined = isJoined(c.id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      className="glass flex flex-col overflow-hidden rounded-none"
    >
      {/* cover band — mono gradient + oversized monogram watermark */}
      <div
        className="relative h-24 overflow-hidden"
        style={{ background: gradientFor(c.seed) }}
      >
        <span className="absolute -right-2 -top-4 select-none font-display text-[7rem] font-black leading-none text-bone/[0.06]">
          {initials(c.name)}
        </span>
        <div className="absolute bottom-2.5 left-4 flex items-center gap-1.5 text-[11px] text-bone/80">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-bone" />
          </span>
          {compact(c.online)} en ligne
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-black tracking-mega text-bone">
                {c.name}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ash">{c.tagline}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleJoin(c.id)}
              aria-pressed={joined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors active:scale-95 ${
                joined
                  ? "bg-bone/10 text-bone ring-1 ring-bone/40"
                  : "bg-bone text-ink"
              }`}
            >
              {joined ? (
                <>
                  <Check className="size-3.5" /> Rejoint
                </>
              ) : (
                "Rejoindre"
              )}
            </button>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-bone/80">
            {c.about}
          </p>
        </div>

        {/* topics */}
        <div className="flex flex-wrap gap-1.5">
          {c.topics.map((t) => (
            <span
              key={t}
              className="border border-bone/20 px-2.5 py-1 text-[11px] font-medium text-bone/70"
            >
              {t}
            </span>
          ))}
        </div>

        {/* host + members + posts */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={c.host.name} seed={c.host.seed} className="size-8" />
            <div className="min-w-0 leading-tight">
              <p className="flex items-center gap-1 truncate text-[12px] font-semibold text-bone">
                {c.host.name}
                {c.host.verified && (
                  <Verified className="size-3.5 shrink-0 text-bone" />
                )}
              </p>
              <p className="overline text-[8.5px] text-ash">Animé par</p>
            </div>
          </div>

          {/* member avatar stack */}
          <div className="flex items-center -space-x-2">
            {c.memberSeeds.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-full ring-2 ring-coal"
                style={{ borderRadius: 9999 }}
              >
                <Avatar name={s} seed={s} className="size-6" />
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-ash">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> {compact(c.members)} membres
          </span>
          <span className="flex items-center gap-1.5">
            <Comment className="size-3.5" /> {compact(c.posts)} discussions
          </span>
        </div>

        {/* thread preview */}
        <div className="flex flex-col gap-2.5 pt-1">
          <p className="overline text-[9px] text-bone/50">À la une</p>
          {c.threads.map((t) => (
            <div
              key={t.title}
              className="flex gap-3 rounded-none bg-bone/[0.03] p-3"
            >
              <Avatar name={t.author} seed={t.seed} className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-bone">
                  {t.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ash">
                  {t.excerpt}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-[10.5px] text-ash/80">
                  <span>@{t.handle}</span>
                  <span className="size-0.5 rounded-full bg-ash" />
                  <span>{t.replies} réponses</span>
                  <span className="size-0.5 rounded-full bg-ash" />
                  <span>{t.time}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
