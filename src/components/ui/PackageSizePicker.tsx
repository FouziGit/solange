"use client";

import { useId } from "react";
import { euro } from "@/lib/utils";
import {
  PACKAGE_SIZES,
  PACKAGE_WEIGH_HINT,
  shippingCents,
  weightLabel,
  type PackageSizeId,
} from "@/lib/shipping";

/**
 * Taille du colis, choisie par le vendeur au dépôt puis figée (D-037).
 * Même motif que le choix de livraison du paiement : de vrais boutons
 * radio (flèches natives, « 1 sur 4, coché »), posés transparents sur
 * toute la carte. Le prix affiché est celui du Point Relais, payé par
 * l'acheteur, lu dans la grille partagée avec le serveur.
 *
 * Le groupe est nommé par `labelledBy` (id d'un FieldLabel) et décrit par
 * la consigne de pesée, affichée juste en dessous.
 */
export function PackageSizePicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  value: PackageSizeId | null;
  onChange: (id: PackageSizeId) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  const uid = useId();
  const hintId = `${uid}-pesee`;
  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-required="true"
        aria-describedby={describedBy ? `${hintId} ${describedBy}` : hintId}
        className="grid gap-2 sm:grid-cols-2"
      >
        {PACKAGE_SIZES.map((s) => {
          const on = value === s.id;
          return (
            <label
              key={s.id}
              className={`relative flex min-h-11 cursor-pointer items-center gap-3 border p-3 text-left transition-colors ${
                on
                  ? "border-bone bg-bone/[0.06]"
                  : "border-bone/20 bg-bone/[0.02] hover:border-bone/40"
              }`}
            >
              <input
                type="radio"
                name={uid}
                value={s.id}
                checked={on}
                onChange={() => onChange(s.id)}
                className="absolute inset-0 size-full cursor-pointer appearance-none"
              />
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                  on ? "border-bone" : "border-bone/30"
                }`}
              >
                {on && <span className="size-2.5 rounded-full bg-bone" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-bone">
                  {s.label} · jusqu&apos;à {weightLabel(s.maxWeightG)}
                </span>
                <span className="block text-[13px] leading-snug text-ash">
                  {s.examples}
                </span>
              </span>
              <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-bone">
                {euro(shippingCents("mondial_relay", s.id) / 100)}
                <span className="sr-only">
                  {" "}
                  en Point Relais, payé par l&apos;acheteur
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p id={hintId} className="mt-2 text-[13px] leading-snug text-ash">
        {PACKAGE_WEIGH_HINT}
      </p>
    </>
  );
}
