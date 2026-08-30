"use client";

import Link from "next/link";
import type { Creator } from "@/lib/mock";
import { compact } from "@/lib/utils";
import { Avatar } from "../chrome/Avatar";
import { TogglePill } from "../ui/TogglePill";
import { Verified } from "../chrome/icons";

export function CreatorHeader({
  creator,
  following,
  onToggleFollow,
}: {
  creator: Creator;
  following: boolean;
  onToggleFollow: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* bloc auteur → profil public (zone tactile ≥44px, hors bouton Suivre) */}
      <Link
        href={`/membre/${encodeURIComponent(creator.handle)}`}
        data-cursor="link"
        aria-label={`Voir le profil de @${creator.handle}`}
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-11 min-w-0 items-center gap-3"
      >
        <div className="relative shrink-0">
          <span
            className={`absolute -inset-[3px] rounded-full ${
              creator.live
                ? "bg-gradient-to-tr from-bone via-bone to-bone"
                : "bg-bone/25"
            }`}
          />
          <Avatar
            name={creator.name}
            seed={creator.seed}
            className="relative size-11 text-2xl ring-2 ring-ink"
          />
          {creator.live && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-bone px-1.5 py-px text-[8px] font-bold tracking-wider text-ink">
              LIVE
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-bone">
              @{creator.handle}
            </span>
            {creator.verified && <Verified className="size-4 text-bone" />}
          </div>
          <p className="text-[11px] text-ash">
            {creator.name} · {compact(creator.followers)} abonnés
          </p>
        </div>
      </Link>

      <TogglePill
        on={following}
        onToggle={onToggleFollow}
        labelOn="Suivi"
        labelOff="Suivre"
        size="sm"
        className="ml-1"
      />
    </div>
  );
}
