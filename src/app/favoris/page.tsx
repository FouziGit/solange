"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { TogglePill } from "@/components/ui/TogglePill";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified } from "@/components/chrome/icons";
import { looks } from "@/lib/mock";
import type { Creator } from "@/lib/mock";
import { useStore } from "@/lib/store";

type Tab = "pieces" | "vendeurs";

/** Résout les pseudos suivis en fiches affichables.
    Avant, la résolution passait par le seul jeu de démonstration : un
    vendeur RÉEL suivi disparaissait de la liste, et la liste restait
    figée sur trois personnages quoi qu'on suive. On part désormais des
    pseudos réellement suivis ; ceux qu'on ne connaît pas sont rendus
    avec une fiche minimale plutôt que d'être ignorés. */
type SuiviAffichable = Pick<Creator, "handle" | "name" | "seed"> & {
  verified?: boolean;
};

function resoudreSuivis(handles: string[]): SuiviAffichable[] {
  const byHandle = new Map<string, Creator>();
  for (const l of looks) byHandle.set(l.creator.handle, l.creator);
  return handles.map(
    (h) =>
      byHandle.get(h) ?? {
        /* Fiche minimale : on n'invente NI nombre d'abonnés NI badge.
           Le nombre d'abonnés d'un membre réel n'est pas connu ici, et
           l'afficher au jugé serait un compteur fabriqué de plus. */
        handle: h,
        name: h,
        seed: h,
      },
  );
}

function FollowToggle({ handle }: { handle: string }) {
  const { isFollowing, toggleFollow } = useStore();
  return (
    <TogglePill
      on={isFollowing(handle)}
      onToggle={() => toggleFollow(handle)}
      labelOn="Suivi"
      labelOff="Suivre"
      size="sm"
    />
  );
}

export default function FavorisPage() {
  const [tab, setTab] = useState<Tab>("pieces");
  const { savedItems, followedList } = useStore();
  const saved = savedItems();
  const creators = useMemo(() => resoudreSuivis(followedList), [followedList]);

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
              {/* menait vers /profil : chaque vendeur suivi renvoyait le
                  membre vers SA propre page, jamais vers celle du vendeur */}
              <Link
                href={`/membre/${c.handle}`}
                data-cursor="link"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar
                  name={c.name}
                  seed={c.seed}
                  decorative
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
