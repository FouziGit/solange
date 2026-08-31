"use client";

/* ============================================================
   SOLANGE — réglages des notifications (lot 3), dans /profil.
   Un interrupteur par type d'événement, des heures calmes, et une
   coupure globale en un geste. Ce que la personne coupe ici, le
   serveur le respecte (décidé par src/lib/push-rules).
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DEFAULT_PREFS,
  PUSH_LABELS,
  PUSH_TYPES,
  type PushPrefs,
} from "@/lib/push-rules";
import {
  pushSupport,
  subscribeDevice,
  unsubscribeDevice,
} from "@/lib/push-client";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Skeleton } from "@/components/ui/Skeleton";

type State =
  | { kind: "loading" }
  | { kind: "off" } // serveur sans clés : rien à régler
  | { kind: "ready"; subscribed: boolean; prefs: PushPrefs };

export function PushSettings() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.pushConfig();
    if (!res.ok || !res.data.enabled) {
      setState({ kind: "off" });
      return;
    }
    setState({
      kind: "ready",
      subscribed: res.data.subscribed,
      prefs: res.data.prefs ?? DEFAULT_PREFS,
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  // Le lot est éteint (pas de clés VAPID) : on n'affiche rien plutôt que
  // de promettre un réglage qui ne ferait rien.
  if (state.kind === "off") return null;

  if (state.kind === "loading")
    return (
      <div className="mt-8 md:max-w-md" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>
    );

  const save = async (next: PushPrefs) => {
    setState({ ...state, prefs: next }); // optimiste
    const res = await api.pushPrefs(next);
    if (res.ok) setState({ ...state, prefs: res.data.prefs });
  };

  const toggleType = (t: (typeof PUSH_TYPES)[number]) =>
    void save({
      ...state.prefs,
      types: { ...state.prefs.types, [t]: !state.prefs.types[t] },
    });

  const activate = async () => {
    setBusy(true);
    setMessage(null);
    const support = pushSupport();
    if (support.kind === "ios-install") {
      setBusy(false);
      setMessage(
        "Sur iPhone : ajoute d'abord SOLANGE à ton écran d'accueil (Partager → Sur l'écran d'accueil), puis rouvre l'app depuis l'icône.",
      );
      return;
    }
    if (support.kind === "denied") {
      setBusy(false);
      setMessage(
        "Ton navigateur bloque les notifications pour SOLANGE. Réautorise-les dans ses réglages de site.",
      );
      return;
    }
    const res = await subscribeDevice();
    setBusy(false);
    if (res.ok) {
      setMessage("Cet appareil recevra les notifications.");
      void load();
    } else {
      setMessage(res.error);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    await unsubscribeDevice();
    setBusy(false);
    setMessage("Cet appareil ne recevra plus de notifications.");
    void load();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <section className="mt-8 md:max-w-md" aria-label="Notifications">
      <p className="etiquette mb-3 text-[11px] text-ash">Notifications</p>

      <div className="border border-bone/12 p-4">
        {!state.subscribed ? (
          <>
            <p className="text-[13px] leading-relaxed text-ash">
              Cet appareil ne reçoit rien pour l&apos;instant.
            </p>
            <Button
              size="md"
              className="mt-3"
              disabled={busy}
              onClick={() => void activate()}
            >
              {busy ? "Activation…" : "Activer sur cet appareil"}
            </Button>
          </>
        ) : (
          <>
            {/* coupure globale : un geste, sans passer par les réglages OS */}
            <label className="flex items-center justify-between gap-4">
              <span className="text-[13.5px] font-semibold text-bone">
                Recevoir les notifications
              </span>
              <input
                type="checkbox"
                checked={state.prefs.enabled}
                onChange={() =>
                  void save({ ...state.prefs, enabled: !state.prefs.enabled })
                }
                className="size-5 accent-bone"
              />
            </label>

            <div
              className={`mt-4 flex flex-col gap-2.5 border-t border-bone/10 pt-4 ${
                state.prefs.enabled ? "" : "pointer-events-none opacity-40"
              }`}
            >
              {PUSH_TYPES.filter((t) => t !== "report").map((t) => (
                <label
                  key={t}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-[13px] text-bone/85">
                    {PUSH_LABELS[t]}
                  </span>
                  <input
                    type="checkbox"
                    checked={state.prefs.types[t]}
                    onChange={() => toggleType(t)}
                    className="size-4 accent-bone"
                  />
                </label>
              ))}

              <div className="mt-2 border-t border-bone/10 pt-4">
                <FieldLabel>Heures calmes</FieldLabel>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Début des heures calmes"
                    value={state.prefs.quietFrom}
                    onChange={(e) =>
                      void save({
                        ...state.prefs,
                        quietFrom: Number(e.target.value),
                      })
                    }
                    className="field flex-1"
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")} h
                      </option>
                    ))}
                  </select>
                  <span className="text-[12px] text-ash">→</span>
                  <select
                    aria-label="Fin des heures calmes"
                    value={state.prefs.quietTo}
                    onChange={(e) =>
                      void save({
                        ...state.prefs,
                        quietTo: Number(e.target.value),
                      })
                    }
                    className="field flex-1"
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")} h
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-[11.5px] text-ash">
                  Rien ne sonne pendant cette plage. Tout reste dans ta cloche.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-bone/10 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void api.pushTest()}
              >
                Tester
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void deactivate()}
              >
                Couper sur cet appareil
              </Button>
            </div>
          </>
        )}

        {message && (
          <p role="status" className="mt-3 text-[12.5px] text-bone/85">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
