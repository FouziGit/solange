"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { ProductCard } from "@/components/ui/ProductCard";
import { catalog, trendingTags } from "@/lib/mock";
import { catalogBrands } from "@/lib/data";
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

/** Catalog pieces offered as taggable / linkable items in the composer. */
const taggable = catalog.slice(0, 8);

/** The three post types of the composer. */
type PostKind = "look" | "actu" | "achats";

const KINDS: { id: PostKind; label: string; hint: string }[] = [
  {
    id: "look",
    label: "Look shoppable",
    hint: "Mise en scène 9:16, pièces taguées — shoppable dans le feed.",
  },
  {
    id: "actu",
    label: "Actu / collection",
    hint: "Un drop, une collection, une actu mode — texte + marques taguées.",
  },
  {
    id: "achats",
    label: "Mes achats",
    hint: "Partage tes trouvailles et lie les pièces de la marketplace.",
  },
];

export default function CreerPage() {
  const [kind, setKind] = useState<PostKind>("look");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagged, setTagged] = useState<string[]>(["k1"]);
  const [hashtags, setHashtags] = useState<string[]>(["#archive"]);
  const [brandSel, setBrandSel] = useState<string[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  const brands = useMemo(() => catalogBrands(), []);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    );

  const switchKind = (k: PostKind) => {
    setKind(k);
    setPublished(false);
  };

  const seed = useMemo(
    () => `solange-creer-${kind}-${title.trim() || "edito"}`,
    [kind, title],
  );

  const taggedItems = taggable.filter((it) => tagged.includes(it.id));
  const linkedItems = taggable.filter((it) => linked.includes(it.id));
  const minPrice = taggedItems.length
    ? Math.min(...taggedItems.map((it) => it.priceEUR))
    : 0;

  /* per-type readiness + missing hints, comme sur Vendre */
  const ready =
    kind === "look"
      ? Boolean(title.trim())
      : kind === "actu"
        ? Boolean(caption.trim() && brandSel.length)
        : Boolean(caption.trim() && linked.length);
  const missing = (
    kind === "look"
      ? [!title.trim() && "un titre"]
      : kind === "actu"
        ? [!caption.trim() && "un texte", !brandSel.length && "une marque"]
        : [!caption.trim() && "un texte", !linked.length && "une pièce liée"]
  ).filter(Boolean) as string[];

  const ctaLabel =
    kind === "look"
      ? "Publier le look"
      : kind === "actu"
        ? "Publier l'actu"
        : "Publier mes achats";

  const kindMeta = KINDS.find((k) => k.id === kind)!;

  return (
    <PageShell marginWord="Créer">
      <PageHeader
        eyebrow="Créer = publier dans le feed"
        title="Créer"
        subtitle="Look shoppable, actu de collection ou haul de tes derniers achats — compose, et il part dans le feed."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* composer form */}
        <div className="space-y-6">
          {/* post type — segmented row */}
          <div>
            <Label>Type de post</Label>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Chip
                  key={k.id}
                  active={kind === k.id}
                  onClick={() => switchKind(k.id)}
                >
                  {k.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ash">{kindMeta.hint}</p>
          </div>

          {/* media drop-zone — look only */}
          {kind === "look" && (
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
          )}

          {/* editorial title */}
          <div>
            <Label>Titre éditorial</Label>
            <GlassInput
              aria-label="Titre éditorial du post"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "look"
                  ? "Archive · Plissé · Gorpcore…"
                  : kind === "actu"
                    ? "Le drop Lemaire SS26…"
                    : "Haul du week-end…"
              }
            />
          </div>

          {/* caption / texte */}
          <div>
            <Label>{kind === "look" ? "Légende" : "Texte"}</Label>
            <GlassInput
              multiline
              aria-label={kind === "look" ? "Légende du look" : "Texte du post"}
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                kind === "look"
                  ? "Raconte la pièce, où tu l'as chinée, comment tu la portes…"
                  : kind === "actu"
                    ? "Raconte l'actu : le drop, la collection, pourquoi ça compte…"
                    : "Raconte tes achats : où, combien, pourquoi ces pièces…"
              }
              className="resize-none"
            />
          </div>

          {/* brand tags — actu + achats */}
          {kind !== "look" && (
            <div>
              <Label>Tagguer des marques</Label>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <Chip
                    key={b}
                    active={brandSel.includes(b)}
                    onClick={() => toggle(setBrandSel, b)}
                  >
                    {b}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ash">
                {brandSel.length} marque{brandSel.length > 1 ? "s" : ""} taguée
                {brandSel.length > 1 ? "s" : ""} · le post remonte dans leur
                recherche.
              </p>
            </div>
          )}

          {/* linked marketplace pieces — achats */}
          {kind === "achats" && (
            <div>
              <Label>Lier des articles de la marketplace</Label>
              <div className="flex flex-wrap gap-2">
                {taggable.map((it) => (
                  <Chip
                    key={it.id}
                    active={linked.includes(it.id)}
                    onClick={() => toggle(setLinked, it.id)}
                  >
                    {it.brand} · {it.name}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ash">
                {linked.length} pièce{linked.length > 1 ? "s" : ""} liée
                {linked.length > 1 ? "s" : ""} · elles s&apos;affichent sous ton
                post, achetables en un tap.
              </p>
            </div>
          )}

          {/* tag pieces — look */}
          {kind === "look" && (
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
          )}

          {/* trending tags — look */}
          {kind === "look" && (
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
          )}
        </div>

        {/* sticky live preview */}
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <Label>Aperçu</Label>
          <div className="overflow-hidden rounded-3xl border border-bone/12 bg-coal/60 p-3">
            {published ? (
              /* success state — comme sur Vendre */
              <div className="flex flex-col items-center py-6 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-bone text-ink">
                  <Check className="size-7" />
                </span>
                <p className="mt-4 font-editorial text-2xl font-semibold text-bone">
                  Publié ✓
                </p>
                <p className="mt-1 max-w-[24ch] text-[13px] leading-relaxed text-ash">
                  {title.trim() || "Ton post"} est parti dans le feed « Pour
                  toi » et chez tes abonnés.
                </p>
                <button
                  onClick={() => setPublished(false)}
                  className="mt-6 rounded-none border border-bone/30 px-5 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
                >
                  Créer un autre post
                </button>
              </div>
            ) : (
              <>
                {kind === "look" ? (
                  /* mini feed stage — 9:16 tile */
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
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-none glass px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-bone/85">
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
                ) : (
                  /* sharp editorial card — actu / achats */
                  <div className="border border-bone/15 bg-ink/40">
                    <div className="flex items-center justify-between border-b border-bone/15 px-4 py-2.5">
                      <span className="overline text-[9px] text-ash">
                        {kind === "actu" ? "Actu / collection" : "Mes achats"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-bone"
                      />
                    </div>
                    <div className="px-4 py-5">
                      <span className="font-editorial block text-3xl font-semibold italic leading-[0.95] tracking-tight text-bone">
                        {title.trim() || "Sans titre"}
                      </span>
                      <p className="mt-3 text-[12.5px] leading-relaxed text-bone/85">
                        {caption.trim() ||
                          (kind === "actu"
                            ? "Ton texte d'actu s'affiche ici, en carte éditoriale dans le feed."
                            : "Le récit de tes achats s'affiche ici, au-dessus des pièces liées.")}
                      </p>
                      {brandSel.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {brandSel.map((b) => (
                            <span
                              key={b}
                              className="border border-bone/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-bone/80"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {kind === "achats" && linkedItems.length > 0 && (
                      <div className="border-t border-bone/15 p-3">
                        <span className="overline mb-2 block text-[9px] text-ash">
                          Pièces liées · {linkedItems.length}
                        </span>
                        <div className="grid grid-cols-2 gap-2.5">
                          {linkedItems.map((it, i) => (
                            <ProductCard key={it.id} item={it} index={i} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* publish CTA — square brutalist */}
                <button
                  onClick={() => ready && setPublished(true)}
                  disabled={!ready}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-none py-3.5 text-sm font-semibold transition-transform active:scale-95 ${
                    ready
                      ? "bg-bone text-ink"
                      : "cursor-default border border-bone/15 text-ash"
                  }`}
                >
                  <Check className="size-4" /> {ctaLabel}
                </button>
                {!ready && (
                  <p className="mt-2 text-center text-[11px] text-ash">
                    Ajoute {missing.join(", ")} pour publier.
                  </p>
                )}
                <p className="mt-2.5 px-1 text-[10.5px] leading-relaxed text-ash">
                  {kind === "look"
                    ? "Ton look part dans le feed « Pour toi » et chez tes abonnés. Les pièces taguées deviennent shoppables."
                    : kind === "actu"
                      ? "Ton actu part dans le feed en carte éditoriale, taguée aux marques choisies."
                      : "Ton haul part dans le feed avec ses pièces liées, achetables en un tap."}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
