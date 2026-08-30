"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { relayPointsNear, type RelayPoint } from "@/lib/shipping";
import { Pin, Check } from "@/components/chrome/icons";

/**
 * Relay-point picker (Vinted-style) — enter a postal code, pick a nearby relay
 * point. Points are SIMULATED (see lib/shipping) — a real carrier widget/API
 * (Mondial Relay, Boxtal…) plugs in here later.
 */
export function RelayPicker({
  open,
  onClose,
  carrier,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  carrier: string;
  selectedId?: string | null;
  onSelect: (point: RelayPoint) => void;
}) {
  const [postal, setPostal] = useState("");
  const clean = postal.replace(/\D/g, "").slice(0, 5);
  const points = clean.length === 5 ? relayPointsNear(clean) : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={carrier}
      title="Choisir un point relais"
      ariaLabel="Choisir un point relais"
    >
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        <input
          value={postal}
          onChange={(e) => setPostal(e.target.value)}
          inputMode="numeric"
          placeholder="Code postal (ex. 75011)"
          aria-label="Code postal"
          className="field rounded-full text-center text-[15px]"
        />

        {clean.length < 5 ? (
          <p className="mt-4 text-center text-[12.5px] text-ash">
            Entre ton code postal pour voir les points relais proches.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {points.map((p) => {
              const on = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    onClose();
                  }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    on
                      ? "border-bone bg-bone/[0.06]"
                      : "border-bone/12 bg-bone/[0.02] hover:border-bone/30"
                  }`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bone/10 text-bone">
                    <Pin className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-[14px] font-semibold tracking-tight text-bone">
                      {p.name}
                    </span>
                    <span className="block truncate text-[12px] text-ash">
                      {p.address} · {p.postal}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ash">
                      <span>{p.distance}</span>
                      <span className="size-0.5 rounded-full bg-ash" />
                      <span>{p.hours}</span>
                    </span>
                  </span>
                  {on && <Check className="size-5 shrink-0 text-bone" />}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-ash/80">
          Points relais simulés (démo) — la sélection réelle se branchera sur
          l&apos;API du transporteur.
        </p>
      </div>
    </Sheet>
  );
}
