"use client";

import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { announce } from "@/lib/announce";
import {
  RELAY_FIELD_MAX,
  parseManualRelay,
  relayAddressLine,
  relayPointsNear,
  type ManualRelayField,
  type RelayChoice,
} from "@/lib/shipping";
import { Pin, Check, ChevronRight } from "@/components/chrome/icons";

/**
 * Relay-point picker (Vinted-style).
 * - démo (`manual` faux) : code postal → points relais SIMULÉS (lib/shipping).
 * - paiement réel (`manual`) : pas de faux points — l'acheteur cherche le
 *   sien sur le localisateur officiel du transporteur et en recopie les
 *   coordonnées. Une vraie API transporteur se branchera ici plus tard.
 */
export function RelayPicker({
  open,
  onClose,
  carrier,
  locator,
  manual,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  carrier: string;
  locator?: string;
  manual: boolean;
  selectedId?: string | null;
  onSelect: (point: RelayChoice) => void;
}) {
  /* L'état vit ici, pas dans la feuille (démontée à la fermeture) :
     « Modifier » rouvre la saisie telle qu'on l'a laissée. Les saisies
     sont rangées PAR transporteur (voir withRelayField). */
  const [postal, setPostal] = useState("");
  const [drafts, setDrafts] = useState<RelayDrafts>({});
  const pick = (p: RelayChoice) => {
    onSelect(p);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={carrier}
      title="Choisir un point relais"
    >
      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {manual ? (
          <ManualRelay
            carrier={carrier}
            locator={locator}
            values={relayDraftFor(drafts, carrier)}
            setField={(key, value) =>
              setDrafts((d) => withRelayField(d, carrier, key, value))
            }
            onSelect={pick}
          />
        ) : (
          <DemoRelays
            postal={postal}
            setPostal={setPostal}
            selectedId={selectedId}
            onSelect={pick}
          />
        )}
      </div>
    </Sheet>
  );
}

/* ---------- paiement réel : saisie depuis le localisateur ---------- */

type RelayValues = Record<ManualRelayField, string>;
const EMPTY: RelayValues = { name: "", address: "", postal: "", city: "" };

/** Saisies manuelles, une par transporteur. Une seule feuille sert tous
    les transporteurs : avec une saisie unique, un relais Mondial Relay
    recopié réapparaissait pré-rempli sous « Point Relais », et un appui
    sur « Valider » l'enregistrait pour le mauvais réseau — le vendeur
    recevait un point de dépôt d'un autre transporteur. */
export type RelayDrafts = Partial<Record<string, RelayValues>>;

export function relayDraftFor(
  drafts: RelayDrafts,
  carrier: string,
): RelayValues {
  return drafts[carrier] ?? EMPTY;
}

export function withRelayField(
  drafts: RelayDrafts,
  carrier: string,
  key: ManualRelayField,
  value: string,
): RelayDrafts {
  return {
    ...drafts,
    [carrier]: { ...relayDraftFor(drafts, carrier), [key]: value },
  };
}

const FIELDS: {
  key: ManualRelayField;
  label: string;
  inputMode?: "numeric";
}[] = [
  { key: "name", label: "Nom du point relais" },
  { key: "address", label: "Adresse" },
  { key: "postal", label: "Code postal", inputMode: "numeric" },
  { key: "city", label: "Ville" },
];

function ManualRelay({
  carrier,
  locator,
  values,
  setField,
  onSelect,
}: {
  carrier: string;
  locator?: string;
  values: RelayValues;
  setField: (key: ManualRelayField, value: string) => void;
  onSelect: (point: RelayChoice) => void;
}) {
  const uid = useId();
  const idOf = (k: ManualRelayField) => `${uid}-${k}`;
  const errorId = `${uid}-erreur`;
  const [error, setError] = useState<{
    field: ManualRelayField;
    message: string;
  } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseManualRelay(values);
    if (!r.ok) {
      setError({ field: r.field, message: r.message });
      document.getElementById(idOf(r.field))?.focus();
      return;
    }
    setError(null);
    onSelect(r.relay);
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="text-[12.5px] leading-relaxed text-ash">
        Trouve ton point relais sur le site officiel {carrier}, puis recopie ses
        coordonnées ici : le vendeur y déposera ton colis.
      </p>
      {locator && (
        <a
          href={locator}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 border border-bone/25 px-4 text-[13px] font-semibold text-bone transition-colors hover:border-bone/60"
        >
          <span>
            Ouvrir le localisateur {carrier}
            <span className="sr-only"> (site officiel, nouvel onglet)</span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </a>
      )}

      <div className="mt-5 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        {FIELDS.map((f) => {
          const id = idOf(f.key);
          const invalid = error?.field === f.key;
          return (
            <div
              key={f.key}
              className={
                f.key === "name" || f.key === "address" ? "col-span-2" : ""
              }
            >
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              <input
                id={id}
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                maxLength={RELAY_FIELD_MAX[f.key]}
                inputMode={f.inputMode}
                /* coordonnées du relais, pas celles de l'acheteur : le
                   remplissage automatique y mettrait son adresse */
                autoComplete="off"
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? errorId : undefined}
                className="field w-full"
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-4 text-[12.5px] leading-snug text-bone"
        >
          {error.message}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-5">
        Valider ce point relais
      </Button>
    </form>
  );
}

/* ---------- démo : points relais simulés ---------- */

function DemoRelays({
  postal,
  setPostal,
  selectedId,
  onSelect,
}: {
  postal: string;
  setPostal: (postal: string) => void;
  selectedId?: string | null;
  onSelect: (point: RelayChoice) => void;
}) {
  const clean = postal.replace(/\D/g, "").slice(0, 5);
  const points = clean.length === 5 ? relayPointsNear(clean) : [];

  const onPostal = (value: string) => {
    setPostal(value);
    const next = value.replace(/\D/g, "").slice(0, 5);
    // la liste remplace l'aide sans bruit : on dit combien il y en a
    if (next.length === 5 && next !== clean)
      announce(`${relayPointsNear(next).length} points relais près de ${next}`);
  };

  return (
    <>
      <input
        value={postal}
        onChange={(e) => onPostal(e.target.value)}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="Code postal (ex. 75011)"
        aria-label="Code postal"
        className="field rounded-full text-center text-base md:text-[15px]"
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
                onClick={() => onSelect(p)}
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
                  <span className="font-display block break-words text-[14px] font-semibold tracking-tight text-bone">
                    {p.name}
                  </span>
                  <span className="block break-words text-[12px] text-ash">
                    {relayAddressLine(p)}
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

      <p className="mt-5 text-center text-[11px] leading-relaxed text-ash">
        Points relais simulés (démo) — la sélection réelle se branchera sur
        l&apos;API du transporteur.
      </p>
    </>
  );
}
