"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { catalog, trendingTags } from "@/lib/mock";
import { euro, gradientFor } from "@/lib/utils";
import {
  Camera,
  Bag,
  ChevronUp,
  Check,
  Sparkle,
} from "@/components/chrome/icons";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="overline mb-2 block text-[9px] text-ash">{children}</span>
  );
}

/** Catalog pieces offered as taggable items in the composer. */
const taggable = catalog.slice(0, 8);

export default function CreerPage() {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagged, setTagged] = useState<string[]>(["k1"]);
  const [hashtags, setHashtags] = useState<string[]>(["#archive"]);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    );

  const seed = useMemo(
    () => `solange-creer-${title.trim() || "edito"}`,
    [title],
  );

  const taggedItems = taggable.filter((it) => tagged.includes(it.id));
  const minPrice = taggedItems.length
    ? Math.min(...taggedItems.map((it) => it.priceEUR))
    : 0;

  return (
    <PageShell marginWord="Créer">
      <PageHeader
        eyebrow="Création de contenu"
        title="Créer"
        subtitle="Compose un look éditorial shoppable. Médias, légende, pièces taguées — et il part dans le feed."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* composer form */}
        <div className="space-y-6">
          {/* media drop-zone */}
          <div>
            <Label>Médias</Label>
            <button className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-bone/25 text-ash transition-colors hover:border-bone/50 hover:text-bone">
              <Camera className="size-8" />
              <span className="text-[13px] font-medium">
                Dépose une vidéo ou des photos
              </span>
              <span className="text-[11px] text-ash">
                Format 9:16 conseillé · jusqu&apos;à 60 s
              </span>
            </button>
          </div>

          {/* editorial title */}
          <div>
            <Label>Titre éditorial</Label>
            <GlassInput
              aria-label="Titre éditorial du look"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Archive · Plissé · Gorpcore…"
            />
          </div>

          {/* caption */}
          <div>
            <Label>Légende</Label>
            <GlassInput
              multiline
              aria-label="Légende du look"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Raconte la pièce, où tu l'as chinée, comment tu la portes…"
              className="resize-none"
            />
          </div>

          {/* tag pieces */}
          <div>
            <Label>Tagguer des pièces</Label>
            <div className="flex flex-wrap gap-2">
              {taggable.map((it) => (
                <Chip
                  key={it.id}
                  active={tagged.includes(it.id)}
                  onClick={() => toggle(setTagged, it.id)}
                >
                  {it.brand} · {it.name}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ash">
              {tagged.length} pièce{tagged.length > 1 ? "s" : ""} taguée
              {tagged.length > 1 ? "s" : ""} · elles apparaissent dans « Shop
              the look ».
            </p>
          </div>

          {/* trending tags */}
          <div>
            <Label>Tags tendances</Label>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((t) => (
                <Chip
                  key={t}
                  active={hashtags.includes(t)}
                  onClick={() => toggle(setHashtags, t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* sticky live preview */}
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <Label>Aperçu</Label>
          <div className="overflow-hidden rounded-3xl border border-bone/12 bg-coal/60 p-3">
            {/* mini feed stage — 9:16 tile */}
            <div
              className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-bone/10"
              style={{ background: gradientFor(seed) }}
            >
              {/* top key-light */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(54% 42% at 32% 22%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 42%, transparent 66%)",
                }}
              />
              {/* badge */}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full glass px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-bone/85">
                <Sparkle className="size-3" /> Édito
              </span>

              {/* editorial title */}
              <div className="absolute inset-x-4 top-1/3">
                <span className="font-editorial block text-4xl font-semibold italic leading-[0.9] tracking-tight text-bone">
                  {title.trim() || "Sans titre"}
                </span>
              </div>

              {/* caption overlay */}
              <div className="absolute inset-x-0 bottom-0">
                <div className="h-28 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 space-y-2.5">
                  <p className="line-clamp-2 text-[12px] leading-snug text-bone/90">
                    {caption.trim() ||
                      "Ta légende s'affiche ici, au-dessus des pièces shoppables."}
                  </p>
                  {hashtags.length > 0 && (
                    <p className="truncate text-[11px] text-bone/55">
                      {hashtags.join(" ")}
                    </p>
                  )}

                  {/* Shop the look pill — identical to ShopTheLook trigger */}
                  <div className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bone text-ink">
                      <Bag className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-bone">
                        Shop the look
                      </span>
                      <span className="block text-[11px] text-ash">
                        {taggedItems.length} pièce
                        {taggedItems.length > 1 ? "s" : ""}
                        {taggedItems.length > 0
                          ? ` · dès ${euro(minPrice)}`
                          : ""}
                      </span>
                    </span>
                    <ChevronUp className="size-5 text-bone/80" />
                  </div>
                </div>
              </div>
            </div>

            {/* publish CTA */}
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-bone py-3.5 text-sm font-semibold text-ink transition-transform active:scale-95">
              <Check className="size-4" /> Publier le look
            </button>
            <p className="mt-2.5 px-1 text-[10.5px] leading-relaxed text-ash">
              Ton look part dans le feed « Pour toi » et chez tes abonnés. Les
              pièces taguées deviennent shoppables.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
