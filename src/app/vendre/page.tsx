"use client";

import { Button } from "@/components/ui/Button";
import { useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { categories, conditions } from "@/lib/mock";
import { commission, euro, gradientFor } from "@/lib/utils";
import { api, resizeImage } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Camera, Crown, Check, X } from "@/components/chrome/icons";

const cats = categories.filter((c) => c !== "Tout");

const MAX_PHOTOS = 4;

export default function VendrePage() {
  const { user, authReady, refreshProducts } = useStore();

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [cat, setCat] = useState<string>("");
  const [cond, setCond] = useState<string>("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [boost, setBoost] = useState(false);
  const [listed, setListed] = useState(false);

  const [images, setImages] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const p = Number(price) || 0;
  const { rate, fee, net } = commission(p);

  const ready = Boolean(title.trim() && p > 0 && cond);
  const missing = [
    !title.trim() && "un titre",
    !(p > 0) && "un prix",
    !cond && "un état",
  ].filter(Boolean) as string[];

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);

    const slots = MAX_PHOTOS - images.length;
    if (slots <= 0) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    const picked = files.slice(0, slots);

    setPhotoBusy(true);
    try {
      const urls: string[] = [];
      for (const f of picked) urls.push(await resizeImage(f));
      setImages((cur) => [...cur, ...urls].slice(0, MAX_PHOTOS));
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
    setImages((cur) => cur.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  async function publish() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await api.createProduct({
      name: title.trim(),
      brand: brand.trim(),
      category: cat,
      condition: cond,
      size: size.trim(),
      priceEUR: Number(price),
      description: desc.trim() || undefined,
      images,
    });
    if (res.ok) {
      setListed(true);
      void refreshProducts();
    } else {
      setSubmitError(res.error);
    }
    setSubmitting(false);
  }

  function resetForm() {
    setListed(false);
    setTitle("");
    setBrand("");
    setCat("");
    setCond("");
    setSize("");
    setPrice("");
    setDesc("");
    setBoost(false);
    setImages([]);
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
    <PageShell>
      <PageHeader
        back="/"
        eyebrow="Vendre = mettre en vente"
        title="Déposer"
        subtitle="Mets une pièce en vente en moins d'une minute. Commission légère, tu fixes ton prix."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* form */}
        <div className="space-y-6">
          {/* photos */}
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
                disabled={photoBusy || images.length >= MAX_PHOTOS}
                className={`col-span-2 row-span-2 flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-ash transition-colors ${
                  images.length >= MAX_PHOTOS
                    ? "cursor-default border-bone/10 text-ash/50"
                    : "border-bone/25 hover:border-bone/50 hover:text-bone"
                }`}
              >
                <Camera className="size-7" />
                <span className="text-[11px]">
                  {photoBusy
                    ? "Traitement…"
                    : images.length >= MAX_PHOTOS
                      ? `${MAX_PHOTOS} photos max`
                      : "Ajoute des photos"}
                </span>
              </button>
              {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                const src = images[i];
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
              Jusqu&apos;à {MAX_PHOTOS} photos · la première sert de couverture.
            </p>
            {photoError && (
              <p className="mt-1 text-[11px] text-ash" role="alert">
                {photoError}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel>Titre de l&apos;annonce</FieldLabel>
              <GlassInput
                aria-label="Titre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Veste en cuir vintage"
              />
            </div>
            <div>
              <FieldLabel>Marque</FieldLabel>
              <GlassInput
                aria-label="Marque"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Acne Studios"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Catégorie</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Chip key={c} active={c === cat} onClick={() => setCat(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel>Taille</FieldLabel>
              <GlassInput
                aria-label="Taille"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="M · 38 · 42…"
              />
            </div>
            <div>
              <FieldLabel>Prix (€)</FieldLabel>
              <GlassInput
                aria-label="Prix"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="245"
              />
            </div>
          </div>

          <div>
            <FieldLabel>État</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <Chip key={c} active={c === cond} onClick={() => setCond(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <GlassInput
              multiline
              aria-label="Description"
              rows={4}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Raconte l'histoire de la pièce, sa coupe, ses petits défauts…"
              className="resize-none"
            />
          </div>
        </div>

        {/* summary (sticky) */}
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <div className="rounded-3xl border border-bone/12 bg-coal/60 p-5">
            {listed ? (
              /* success state — l'annonce existe réellement côté serveur */
              <div className="flex flex-col items-center py-6 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-bone text-ink">
                  <Check className="size-7" />
                </span>
                <p className="mt-4 font-editorial text-2xl font-semibold text-bone">
                  En ligne ✓
                </p>
                <p className="mt-1 max-w-[26ch] text-[13px] leading-relaxed text-ash">
                  {title || "Ta pièce"} est publiée : ton annonce est désormais
                  visible par tout le monde dans le Marché.
                </p>
                <Button href="/decouvrir" size="lg" className="mt-6">
                  Voir dans le Marché
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={resetForm}
                  className="mt-3"
                >
                  Déposer une autre pièce
                </Button>
              </div>
            ) : (
              <>
                {/* preview */}
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-14 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
                    style={{
                      background: gradientFor(brand || title || "solange-new"),
                    }}
                  >
                    {images[0] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={images[0]}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="font-editorial text-xs italic text-bone/40">
                        {(brand || "SOLANGE").slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="overline text-[9px] text-ash">
                      {brand || "Marque"}
                    </p>
                    <p className="truncate text-sm text-bone">
                      {title || "Ton article"}
                    </p>
                  </div>
                </div>

                <div className="my-4 h-px bg-bone/10" />

                {/* commission breakdown */}
                <div className="space-y-2 text-[13px]">
                  <Row label="Prix de vente" value={euro(p)} />
                  <Row
                    label={`Commission (${(rate * 100).toFixed(1).replace(".0", "")} %)`}
                    value={`− ${euro(fee)}`}
                    muted
                  />
                  {boost && (
                    <Row label="Mise en avant 72 h" value="− 2 €" muted />
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between rounded-2xl bg-bone/[0.05] px-4 py-3">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-ash">
                    Tu reçois
                  </span>
                  <span className="font-display text-2xl font-bold text-bone">
                    {euro(Math.max(0, net - (boost ? 2 : 0)))}
                  </span>
                </div>

                <p className="mt-3 text-[10.5px] leading-relaxed text-ash">
                  Commission dégressive : 4 % &lt; 200 € · 3,5 % 200–500 € · 2,5
                  % 500–1000 € · 2 % &gt; 1000 €.
                </p>

                {/* boost toggle */}
                <button
                  role="switch"
                  aria-checked={boost}
                  onClick={() => setBoost((b) => !b)}
                  className="mt-4 flex w-full items-center justify-between rounded-2xl border border-bone/12 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-[13px] font-medium text-bone">
                      Mise en avant 72 h
                    </span>
                    <span className="block text-[11px] text-ash">
                      Boost ta visibilité dans le feed · 2 €
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-11 rounded-full transition-colors ${boost ? "bg-bone" : "bg-bone/15"}`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-ink transition-all ${boost ? "left-[22px]" : "left-0.5 bg-bone"}`}
                    />
                  </span>
                </button>

                {/* premium upsell — dynamic when a price is set */}
                <Link
                  href="/premium"
                  className="mt-3 flex items-center gap-2 rounded-2xl bg-bone/[0.04] px-4 py-3 text-[12px] text-bone/85 transition-colors hover:bg-bone/[0.08]"
                >
                  <Crown className="size-4 shrink-0" />
                  <span>
                    {p > 0 ? (
                      <>
                        <b className="font-semibold text-bone">{euro(fee)}</b>{" "}
                        de commission sur cette vente —{" "}
                        <b className="font-semibold text-bone">0 €</b> avec
                        Premium.
                      </>
                    ) : (
                      <>
                        Passe <b className="font-semibold text-bone">Premium</b>{" "}
                        et garde 0 % de commission.
                      </>
                    )}
                  </span>
                </Link>

                {authReady && !user ? (
                  /* invité — publier demande une session */
                  <div className="mt-4 rounded-2xl border border-bone/12 bg-bone/[0.04] p-4 text-center">
                    <p className="text-[13px] leading-relaxed text-bone/85">
                      Connecte-toi pour publier ta pièce.
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
                    <button
                      type="button"
                      onClick={() => void publish()}
                      disabled={!ready || submitting || !authReady}
                      className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-none py-3.5 text-sm font-semibold transition-transform active:scale-95 ${
                        ready && !submitting && authReady
                          ? "bg-bone text-ink"
                          : "cursor-default border border-bone/15 text-ash"
                      }`}
                    >
                      {submitting ? (
                        "Publication…"
                      ) : (
                        <>
                          <Check className="size-4" /> Mettre en vente
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
              </>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ash">{label}</span>
      <span className={muted ? "text-ash" : "text-bone"}>{value}</span>
    </div>
  );
}
