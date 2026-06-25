"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { GlassInput } from "@/components/ui/GlassInput";
import { categories, conditions } from "@/lib/mock";
import { commission, euro, gradientFor } from "@/lib/utils";
import { Camera, Crown, Check } from "@/components/chrome/icons";

const cats = categories.filter((c) => c !== "Tout");

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="overline mb-2 block text-[9px] text-ash">{children}</span>
  );
}

export default function VendrePage() {
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [cat, setCat] = useState<string>("");
  const [cond, setCond] = useState<string>("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [boost, setBoost] = useState(false);
  const [listed, setListed] = useState(false);

  const p = Number(price) || 0;
  const { rate, fee, net } = commission(p);

  const ready = Boolean(title.trim() && p > 0 && cond);
  const missing = [
    !title.trim() && "un titre",
    !(p > 0) && "un prix",
    !cond && "un état",
  ].filter(Boolean) as string[];

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
            <Label>Photos</Label>
            <div className="grid grid-cols-4 gap-2.5">
              <button className="col-span-2 row-span-2 flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-bone/25 text-ash transition-colors hover:border-bone/50 hover:text-bone">
                <Camera className="size-7" />
                <span className="text-[11px]">Ajoute des photos</span>
              </button>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl border border-bone/10 bg-bone/[0.03]"
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ash">
              Jusqu&apos;à 8 photos · la première sert de couverture.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Titre de l&apos;annonce</Label>
              <GlassInput
                aria-label="Titre"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Veste en cuir vintage"
              />
            </div>
            <div>
              <Label>Marque</Label>
              <GlassInput
                aria-label="Marque"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Acne Studios"
              />
            </div>
          </div>

          <div>
            <Label>Catégorie</Label>
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
              <Label>Taille</Label>
              <GlassInput
                aria-label="Taille"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="M · 38 · 42…"
              />
            </div>
            <div>
              <Label>Prix (€)</Label>
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
            <Label>État</Label>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <Chip key={c} active={c === cond} onClick={() => setCond(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <GlassInput
              multiline
              aria-label="Description"
              rows={4}
              placeholder="Raconte l'histoire de la pièce, sa coupe, ses petits défauts…"
              className="resize-none"
            />
          </div>
        </div>

        {/* summary (sticky) */}
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <div className="rounded-3xl border border-bone/12 bg-coal/60 p-5">
            {listed ? (
              /* success state */
              <div className="flex flex-col items-center py-6 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-bone text-ink">
                  <Check className="size-7" />
                </span>
                <p className="mt-4 font-editorial text-2xl font-semibold text-bone">
                  En ligne ✓
                </p>
                <p className="mt-1 max-w-[24ch] text-[13px] leading-relaxed text-ash">
                  {title || "Ta pièce"} est désormais visible dans Découvrir.
                </p>
                <button
                  onClick={() => setListed(false)}
                  className="mt-6 rounded-full border border-bone/30 px-5 py-2.5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
                >
                  Déposer une autre pièce
                </button>
                <Link
                  href="/creer"
                  className="mt-3 text-[13px] font-medium text-ash transition-colors hover:text-bone"
                >
                  Créer un look avec cette pièce →
                </Link>
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
                    <span className="font-editorial text-xs italic text-bone/40">
                      {(brand || "SOLANGE").slice(0, 3).toUpperCase()}
                    </span>
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

                <button
                  onClick={() => ready && setListed(true)}
                  disabled={!ready}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-95 ${
                    ready
                      ? "bg-bone text-ink"
                      : "cursor-default border border-bone/15 text-ash"
                  }`}
                >
                  <Check className="size-4" /> Mettre en vente
                </button>
                {!ready && (
                  <p className="mt-2 text-center text-[11px] text-ash">
                    Ajoute {missing.join(", ")} pour publier.
                  </p>
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
