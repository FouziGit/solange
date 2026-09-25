"use client";

import { Button } from "@/components/ui/Button";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Stamp } from "@/components/ui/Stamp";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { categories, conditions, universDe } from "@/lib/taxonomie";
import { normaliserMarque, suggestions } from "@/lib/brands";
import { PRIX_MAX_EUR } from "@/lib/payments";
import { commission, euro, gradientFor } from "@/lib/utils";
import { api, resizeImage } from "@/lib/api";
import { announce } from "@/lib/announce";
import { useStore } from "@/lib/store";
import { Camera, Crown, Check, X } from "@/components/chrome/icons";

const cats = categories.filter((c) => c !== "Tout");

const MAX_PHOTOS = 4;

const VENTE_DRAFT = "solange:brouillon-vente";

/** Mention visible dès l'arrivée, lue avec l'étiquette du champ. */
function Obligatoire() {
  return (
    <span className="font-normal normal-case tracking-normal">
      {" "}
      · obligatoire
    </span>
  );
}

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
  } catch {
    /* stockage indisponible — rien à nettoyer */
  }
}

export default function VendrePage() {
  const { user, authReady, refreshProducts } = useStore();

  type VenteDraft = {
    title: string;
    brand: string;
    cat: string;
    cond: string;
    size: string;
    price: string;
    desc: string;
  };
  const draft = readDraft<VenteDraft>(VENTE_DRAFT);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [brand, setBrand] = useState(draft?.brand ?? "");
  const [cat, setCat] = useState<string>(draft?.cat ?? "");
  const [cond, setCond] = useState<string>(draft?.cond ?? "");
  const [size, setSize] = useState(draft?.size ?? "");
  const [price, setPrice] = useState(draft?.price ?? "");
  const [desc, setDesc] = useState(draft?.desc ?? "");
  const [boost, setBoost] = useState(false);
  const [listed, setListed] = useState(false);

  useEffect(() => {
    if (listed) return; // succès → brouillon effacé plus bas
    writeDraft(VENTE_DRAFT, { title, brand, cat, cond, size, price, desc });
  }, [title, brand, cat, cond, size, price, desc, listed]);
  useEffect(() => {
    if (listed) clearDraft(VENTE_DRAFT);
  }, [listed]);

  const [images, setImages] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const uid = useId();
  const addPhotoRef = useRef<HTMLButtonElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  /* Le bouton touché disparaît (retrait d'une photo, publication) : le
     focus est reposé après le rendu, sinon il retombe sur <body> et
     VoiceOver repart du haut de la page. */
  const focusNext = useRef<"photos" | "succes" | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    (target === "succes" ? successRef : addPhotoRef).current?.focus();
  }, [listed, images]);

  const p = Number(price) || 0;
  const { rate, fee, net } = commission(p);

  const tropCher = p > PRIX_MAX_EUR;
  const ready = Boolean(title.trim() && p > 0 && !tropCher && cond);
  const missing = [
    !title.trim() && "un titre",
    !(p > 0) && "un prix",
    tropCher && `un prix de ${PRIX_MAX_EUR.toLocaleString("fr-FR")} € au plus`,
    !cond && "un état",
  ].filter(Boolean) as string[];

  /* « Ajoute des photos » garde le focus quand le sélecteur se referme.
     Bloqué pendant le traitement ou une fois le maximum atteint, il est
     aria-disabled et non disabled : désactivé sous le focus, il renvoyait
     celui-ci sur <body> à chaque ajout, et le clavier repartait du haut. */
  const addBlocked = photoBusy || images.length >= MAX_PHOTOS;

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
      announce(
        urls.length === 1
          ? `Photo ${Math.min(images.length + 1, MAX_PHOTOS)} ajoutée.`
          : `${urls.length} photos ajoutées.`,
      );
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
    focusNext.current = "photos";
    announce(`Photo ${index + 1} retirée.`);
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
      focusNext.current = "succes";
      announce(`${title.trim()} est en ligne dans le Marché.`);
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
    focusNext.current = "photos";
  }

  function goSignIn() {
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {
      /* stockage indisponible — la reconnexion suffit */
    }
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
                ref={addPhotoRef}
                type="button"
                aria-disabled={addBlocked || undefined}
                onClick={() => {
                  if (!addBlocked) fileRef.current?.click();
                }}
                className={`col-span-2 row-span-2 flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-ash transition-colors ${
                  images.length >= MAX_PHOTOS
                    ? "cursor-default border-bone/10"
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
                    {/* bandeau pleine largeur : 11 px lisibles sans déborder
                        de la vignette ; déjà dit par l'alt de la photo */}
                    {i === 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 bg-ink/75 py-0.5 text-center text-[11px] font-medium text-bone"
                      >
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
              <FieldLabel htmlFor={`${uid}-titre`}>
                Titre de l&apos;annonce
                <Obligatoire />
              </FieldLabel>
              <GlassInput
                id={`${uid}-titre`}
                aria-required="true"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Veste en cuir vintage"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${uid}-marque`}>Marque</FieldLabel>
              {/* Liste OUVERTE : on suggère 400 maisons, on n'en impose
                  aucune. Personne ne connaît toutes les marques, et une
                  liste fermée transformerait un dépôt en devinette. La
                  normalisation au départ regroupe « nike », « NIKE » et
                  « Nike » sous un seul libellé dans les filtres. */}
              <GlassInput
                id={`${uid}-marque`}
                list="marques-solange"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onBlur={() => setBrand((v) => normaliserMarque(v))}
                placeholder="Acne Studios"
              />
              <datalist id="marques-solange">
                {suggestions(universDe(cat)).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <FieldLabel id={`${uid}-categorie`}>Catégorie</FieldLabel>
            <div
              role="radiogroup"
              aria-labelledby={`${uid}-categorie`}
              className="flex flex-wrap gap-2"
            >
              {cats.map((c) => (
                <Chip
                  key={c}
                  radio
                  active={c === cat}
                  onClick={() => setCat(c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${uid}-taille`}>Taille</FieldLabel>
              <GlassInput
                id={`${uid}-taille`}
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="M · 38 · 42…"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${uid}-prix`}>
                Prix (€)
                <Obligatoire />
              </FieldLabel>
              <GlassInput
                id={`${uid}-prix`}
                aria-required="true"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="245"
                aria-invalid={tropCher || undefined}
              />
              {tropCher && (
                <p role="alert" className="mt-1.5 text-[12px] text-bone">
                  Prix maximum : {PRIX_MAX_EUR.toLocaleString("fr-FR")} €.
                </p>
              )}
            </div>
          </div>

          <div>
            <FieldLabel id={`${uid}-etat`}>
              État
              <Obligatoire />
            </FieldLabel>
            <div
              role="radiogroup"
              aria-labelledby={`${uid}-etat`}
              aria-required="true"
              className="flex flex-wrap gap-2"
            >
              {conditions.map((c) => (
                <Chip
                  key={c}
                  radio
                  active={c === cond}
                  onClick={() => setCond(c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel htmlFor={`${uid}-description`}>Description</FieldLabel>
            <GlassInput
              multiline
              id={`${uid}-description`}
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
                <Stamp>Déposée</Stamp>
                <h2
                  ref={successRef}
                  tabIndex={-1}
                  className="mt-5 font-editorial text-2xl font-semibold text-bone"
                >
                  En ligne
                </h2>
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
                  {/* fond gradientFor toujours sombre : texte clair dans les
                      deux thèmes */}
                  <span
                    className="theme-dark grid size-14 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
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
                      <span
                        aria-hidden="true"
                        className="font-editorial text-xs italic text-bone/40"
                      >
                        {(brand || "SOLANGE").slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="etiquette text-[11px] text-ash">
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

                <p className="mt-3 text-[12px] leading-relaxed text-ash">
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
                      /* pendant l'envoi : aria-disabled (publish() ignore le
                         second appui), pas disabled — sinon, en cas d'échec, le
                         focus est déjà retombé sur <body> */
                      disabled={!ready || !authReady}
                      aria-disabled={submitting || undefined}
                      aria-describedby={ready ? undefined : `${uid}-manque`}
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
                      <p
                        id={`${uid}-manque`}
                        className="mt-2 text-center text-[11px] text-ash"
                      >
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
