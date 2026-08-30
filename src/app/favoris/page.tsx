"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified } from "@/components/chrome/icons";
import { followedHandles, looks } from "@/lib/mock";
import type { Creator } from "@/lib/mock";
import { useStore } from "@/lib/store";

type Tab = "pieces" | "vendeurs";

/** Resolve followed handles to creator records via the looks dataset. */
function followedCreators(): Creator[] {
  const byHandle = new Map<string, Creator>();
  for (const l of looks) byHandle.set(l.creator.handle, l.creator);
  return followedHandles
    .map((h) => byHandle.get(h))
    .filter((c): c is Creator => c !== undefined);
}

function FollowToggle({ handle }: { handle: string }) {
  const { isFollowing, toggleFollow } = useStore();
  const following = isFollowing(handle);
  return (
    <button
      type="button"
      onClick={() => toggleFollow(handle)}
      aria-pressed={following}
      data-cursor="link"
      className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
        following
          ? "border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone"
          : "border-bone bg-bone text-ink"
      }`}
    >
      {following ? "Suivi" : "Suivre"}
    </button>
  );
}

export default function FavorisPage() {
  const [tab, setTab] = useState<Tab>("pieces");
  const { savedItems } = useStore();
  const saved = savedItems();
  const creators = useMemo(() => followedCreators(), []);

  return (
    <PageShell marginWord="Gardées">
      <PageHeader eyebrow="Ma sélection" title="Gardées" />

      {/* tabs */}
      <div role="tablist" aria-label="Gardées" className="flex gap-2">
        {(
          [
            ["pieces", `Pièces · ${saved.length}`],
            ["vendeurs", `Vendeurs suivis · ${creators.length}`],
          ] as const
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              data-cursor="link"
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? "border-bone bg-bone text-ink"
                  : "border-bone/20 text-bone/70 hover:border-bone/40 hover:text-bone"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* pieces */}
      {tab === "pieces" &&
        (saved.length > 0 ? (
          <div className="mt-7 columns-2 gap-3 md:columns-3 xl:columns-4">
            {saved.map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        ) : (
          <div className="mt-20 flex flex-col items-center gap-5 text-center">
            <p className="max-w-[30ch] text-sm leading-relaxed text-ash">
              Rien de gardé pour l&apos;instant. Repère une pièce et touche
              «&nbsp;Garder&nbsp;» — elle t&apos;attendra ici.
            </p>
            <Button href="/decouvrir" variant="outline">
              Chiner le Marché
            </Button>
          </div>
        ))}

      {/* followed sellers */}
      {tab === "vendeurs" && (
        <div className="mt-7 space-y-2.5">
          {creators.map((c) => (
            <div
              key={c.handle}
              className="glass flex items-center gap-3 rounded-2xl px-3.5 py-3"
            >
              <Link
                href="/profil"
                data-cursor="link"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar
                  name={c.name}
                  seed={c.seed}
                  className="size-12 shrink-0"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-bone">
                      @{c.handle}
                    </span>
                    {c.verified && (
                      <Verified
                        className="size-4 shrink-0 text-bone"
                        aria-label="Profil démo"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-ash">
                    {c.name}
                  </span>
                </span>
              </Link>
              <FollowToggle handle={c.handle} />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
