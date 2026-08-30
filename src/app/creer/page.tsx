"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Stamp } from "@/components/ui/Stamp";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { ProductCard } from "@/components/ui/ProductCard";
import { catalog, trendingTags } from "@/lib/mock";
import { catalogBrands } from "@/lib/data";
import { euro, gradientFor } from "@/lib/utils";
import { api, resizeImage } from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  Camera,
  Bag,
  ChevronUp,
  Check,
  Sparkle,
  X,
} from "@/components/chrome/icons";

const MAX_PHOTOS = 4;

/** Catalog pieces offered as taggable / linkable items in the composer. */
const taggable = catalog.slice(0, 8);

/** The composer publishes a single post kind (a shoppable look). */
type PostKind = "look" | "actu" | "achats";

const CREER_DRAFT = "solange:brouillon-post";

/** Brouillon (sessionStorage) — la saisie survit à un refresh accidentel. */
function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible — tant pis, pas bloquant */
  }
}
function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

export default function CreerPage() {
  const { user, authReady, refreshSession } = useStore();

  const [kind] = useState<PostKind>("look");
  type PostDraft = { title: string; caption: string; hashtags: string[] };
  const draft = readDraft<PostDraft>(CREER_DRAFT);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [caption, setCaption] = useState(draft?.caption ?? "");
  const [tagged, setTagged] = useState<string[]>(["k1"]);
  const [hashtags, setHashtags] = useState<string[]>(
    draft?.hashtags ?? ["#archive"],
  );
  const [brandSel, setBrandSel] = useState<string[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (published) return;
    writeDraft(CREER_DRAFT, { title, caption, hashtags });
  }, [title, caption, hashtags, published]);
  useEffect(() => {
    if (published) clearDraft(CREER_DRAFT);
  }, [published]);

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const brands = useMemo(() => catalogBrands(), []);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    );

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

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);

    const slots = MAX_PHOTOS - photos.length;
    if (slots <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = files.slice(0, slots);

    setPhotoBusy(true);
    try {
      const urls: string[] = [];
      for (const f of picked) urls.push(await resizeImage(f));
      setPhotos((cur) => [...cur, ...urls].slice(0, MAX_PHOTOS));
      if (files.length > slots) {
        setPhotoError(
          `Maximum ${MAX_PHOTOS} photos — seules les ${slots === 1 ? "première a" : `${slots} premières ont`} été gardées.`,
        );
      }
    } catch {
      setPhotoError(
        "Impossible de lire une des photos. Réessaie avec un autre fichier.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((cur) => cur.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  async function publish() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    /* Seuls caption / brandTags / images partent au serveur : le titre et
       les hashtags rejoignent la légende, les pièces taguées donnent leurs
       marques. */
    const brandTags =
      kind === "look"
        ? [...new Set(taggedItems.map((it) => it.brand))]
        : brandSel;
    const serverCaption = [
      title.trim(),
      caption.trim(),
      kind === "look" ? hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await api.createPost({
      caption: serverCaption,
      brandTags,
      images: photos,
    });
    if (res.ok) {
      setPublished(true);
    } else if (res.status === 401) {
      setSubmitError("Ta session a expiré — reconnecte-toi pour publier.");
      void refreshSession();
    } else {
      setSubmitError(res.error);
    }
    setSubmitting(false);
  }

  function resetForm() {
    setPublished(false);
    setTitle("");
    setCaption("");
    setPhotos([]);
    setPhotoError(null);
    setSubmitError(null);
  }

  function goSignIn() {
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {}
    location.reload();
  }

  return (
    <PageShell marginWord="Créer">
      <PageHeader
        title="Créer"
        subtitle="Compose ton look, tague tes pièces — et il part dans le feed."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* composer form */}
        <div className="space-y-6">
          {/* photos — look only */}
          {kind === "look" && (
            <div>
              <FieldLabel>Photos</FieldLabel>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void onFilesPicked(e)}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <div className="grid grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy || photos.length >= MAX_PHOTOS}
                  className={`col-span-2 row-span-2 flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-ash transition-colors ${
                    photos.length >= MAX_PHOTOS
                      ? "cursor-default border-bone/10 text-ash/50"
                      : "border-bone/25 hover:border-bone/50 hover:text-bone"
                  }`}
                >
                  <Camera className="size-7" />
                  <span className="text-[11px] font-medium">
                    {photoBusy
                      ? "Traitement…"
                      : photos.length >= MAX_PHOTOS
                        ? `${MAX_PHOTOS} photos max`
                        : "Ajoute des photos"}
                  </span>
                </button>
                {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                  const src = photos[i];
                  if (!src) {
                    return (
                      <div
                        key={i}
                        className="aspect-square rounded-xl border border-bone/10 bg-bone/[0.03]"
                      />
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="relative aspect-square overflow-hidden rounded-xl border border-bone/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Photo ${i + 1}${i === 0 ? " (couverture)" : ""}`}
                        className="size-full object-cover"
                      />
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-ink/75 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-bone">
                          Couverture
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        aria-label={`Retirer la photo ${i + 1}`}
                        className="absolute right-0 top-0 grid size-11 place-items-start justify-items-end p-1.5"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-ink/80 text-bone ring-1 ring-bone/25 transition-colors hover:bg-ink">
                          <X className="size-3.5" />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-ash">
                Jusqu&apos;à {MAX_PHOTOS} photos · format 9:16 conseillé · la
                première sert de couverture.
              </p>
              {photoError && (
                <p className="mt-1 text-[11px] text-ash" role="alert">
                  {photoError}
                </p>
              )}
            </div>
          )}

          {/* editorial title */}
          <div>
            <FieldLabel>Titre éditorial</FieldLabel>
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
            <FieldLabel>{kind === "look" ? "Légende" : "Texte"}</FieldLabel>
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
              <FieldLabel>Tagguer des marques</FieldLabel>
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
              <FieldLabel>Lier des articles de la marketplace</FieldLabel>
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
                {linked.length > 1 ? "s" : ""} · leurs marques sont taguées sur
                ton post.
              </p>
            </div>
          )}

          {/* tag pieces — look */}
          {kind === "look" && (
            <div>
              <FieldLabel>Tagguer des pièces</FieldLabel>
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
                {tagged.length > 1 ? "s" : ""} · leurs marques sont taguées sur
                ton post.
              </p>
            </div>
          )}

          {/* trending tags — look */}
          {kind === "look" && (
            <div>
              <FieldLabel>Tags tendances</FieldLabel>
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
              <p className="mt-2 text-[11px] text-ash">
                Ajoutés à la fin de ta légende.
              </p>
            </div>
          )}
        </div>

        {/* sticky live preview */}
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <FieldLabel>Aperçu</FieldLabel>
          <div className="overflow-hidden rounded-3xl border border-bone/12 bg-coal/60 p-3">
            {published ? (
              /* success state — comme sur Vendre */
              <div className="flex flex-col items-center py-6 text-center">
                <Stamp>Publié</Stamp>
                <p className="mt-5 font-editorial text-2xl font-semibold text-bone">
                  En ligne
                </p>
                <p className="mt-1 max-w-[24ch] text-[13px] leading-relaxed text-ash">
                  {title.trim() || "Ton post"} est en ligne — visible dans le
                  feed.
                </p>
                <button
                  onClick={resetForm}
                  className="mt-6 min-h-11 rounded-none border border-bone/30 px-5 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
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
                    {/* cover photo, once one is added */}
                    {photos[0] && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photos[0]}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 size-full object-cover"
                      />
                    )}
                    {/* top key-light */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(54% 42% at 32% 22%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 42%, transparent 66%)",
                      }}
                    />
                    {/* badge */}
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-none glass px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-bone/85">
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
                      <span className="overline text-[11px] text-ash">
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
                              className="border border-bone/25 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-bone/80"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {kind === "achats" && linkedItems.length > 0 && (
                      <div className="border-t border-bone/15 p-3">
                        <span className="overline mb-2 block text-[11px] text-ash">
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

                {authReady && !user ? (
                  /* invité — publier demande une session */
                  <div className="mt-3 rounded-2xl border border-bone/12 bg-bone/[0.04] p-4 text-center">
                    <p className="text-[13px] leading-relaxed text-bone/85">
                      Connecte-toi pour publier.
                    </p>
                    <button
                      type="button"
                      onClick={goSignIn}
                      className="mt-3 flex min-h-11 w-full items-center justify-center rounded-none border border-bone/30 px-5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
                    >
                      Se connecter / créer un compte
                    </button>
                  </div>
                ) : (
                  <>
                    {/* publish CTA — square brutalist */}
                    <button
                      type="button"
                      onClick={() => void publish()}
                      disabled={!ready || submitting || !authReady}
                      className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-none py-3.5 text-sm font-semibold transition-transform active:scale-95 ${
                        ready && !submitting && authReady
                          ? "bg-bone text-ink"
                          : "cursor-default border border-bone/15 text-ash"
                      }`}
                    >
                      {submitting ? (
                        "Publication…"
                      ) : (
                        <>
                          <Check className="size-4" /> {ctaLabel}
                        </>
                      )}
                    </button>
                    {!ready && (
                      <p className="mt-2 text-center text-[11px] text-ash">
                        Ajoute {missing.join(", ")} pour publier.
                      </p>
                    )}
                    {submitError && (
                      <p
                        className="mt-2 rounded-xl border border-bone/25 bg-bone/[0.05] px-3 py-2 text-center text-[12px] leading-relaxed text-bone/90"
                        role="alert"
                      >
                        {submitError}
                      </p>
                    )}
                  </>
                )}
                <p className="mt-2.5 px-1 text-[10.5px] leading-relaxed text-ash">
                  {kind === "look"
                    ? "Ton look part dans le feed avec ta légende, tes photos et les marques taguées."
                    : kind === "actu"
                      ? "Ton actu part dans le feed en carte éditoriale, taguée aux marques choisies."
                      : "Ton haul part dans le feed avec son texte et les marques choisies."}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
