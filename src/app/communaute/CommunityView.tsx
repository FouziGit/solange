"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { communities, type Community } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/chrome/Avatar";
import { Search, Users, Check } from "@/components/chrome/icons";
import { compact } from "@/lib/utils";

/**
 * Liste des cercles — volontairement nue : une barre de recherche, une carte
 * par cercle (avatar, nom, description, nombre de membres, rejoindre). Tout
 * le reste (fil de discussions, thématiques, animateur) vit dans la fiche
 * détail (/communaute/[id]) — on ne montre pas tout d'un coup.
 */
export function CommunityView() {
  const { isJoined } = useStore();
  const [q, setQ] = useState("");
  const joinedCount = communities.filter((c) => isJoined(c.id)).length;

  const results = useMemo(() => {
    const qn = q.trim().toLowerCase();
    if (!qn) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(qn) ||
        c.tagline.toLowerCase().includes(qn) ||
        c.topics.some((t) => t.toLowerCase().includes(qn)),
    );
  }, [q]);

  return (
    <PageShell marginWord="Cercles">
      <PageHeader
        eyebrow="Communauté"
        title="Cercles"
        subtitle={
          joinedCount > 0
            ? `Tu fais partie de ${joinedCount} cercle${joinedCount > 1 ? "s" : ""}.`
            : "Rejoins un cercle pour lancer la conversation."
        }
      />

      <div className="glass flex items-center gap-3 rounded-full px-4 py-3">
        <Search className="size-5 shrink-0 text-ash" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un cercle…"
          aria-label="Chercher un cercle"
          className="w-full bg-transparent text-sm text-bone outline-none placeholder:text-ash"
        />
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {results.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ash">
            Aucun cercle ne correspond à «&nbsp;{q}&nbsp;».
          </p>
        ) : (
          results.map((c, i) => (
            <CommunityRow key={c.id} community={c} index={i} />
          ))
        )}
      </div>
    </PageShell>
  );
}

function CommunityRow({
  community: c,
  index,
}: {
  community: Community;
  index: number;
}) {
  const { isJoined, toggleJoin } = useStore();
  const joined = isJoined(c.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index * 0.04, 0.3),
      }}
    >
      <Link
        href={`/communaute/${c.id}`}
        data-cursor="link"
        className="group flex items-center gap-3.5 border border-bone/10 p-3.5 transition-colors hover:border-bone/25 hover:bg-bone/[0.03]"
      >
        <Avatar name={c.name} seed={c.seed} className="size-12 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-bone">
            {c.name}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-ash">{c.tagline}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-ash/80">
            <Users className="size-3" />
            {compact(c.members)} membres
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleJoin(c.id);
          }}
          aria-pressed={joined}
          className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-colors active:scale-95 ${
            joined
              ? "bg-bone/10 text-bone ring-1 ring-bone/30"
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
      </Link>
    </motion.div>
  );
}
