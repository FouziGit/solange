"use client";

/* ============================================================
   SOLANGE — vidéo d'une publication membre (lot 5).
   Lecture auto muette, son au tap, boucle. L'image d'attente
   s'affiche d'abord : jamais de trou noir. Ne charge la vidéo que
   si la carte est proche (préchargement de la suivante seulement).
   « Réduire les animations » coupe la lecture AUTO, pas la lecture :
   un vrai bouton « Lire la vidéo » la lance à la demande.
   ============================================================ */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { Mute, Volume, Play } from "../chrome/icons";

/** Ce que la personne a demandé : rien (lecture auto), lire, ou pause. */
export type PlayIntent = "auto" | "play" | "pause";

/** La vidéo doit-elle tourner ? Une demande explicite passe outre
    « Réduire les animations » et l'économiseur de données. */
export function shouldPlay({
  active,
  intent,
  reduce,
  saveData,
}: {
  active: boolean;
  intent: PlayIntent;
  reduce: boolean;
  saveData: boolean;
}): boolean {
  if (!active) return false;
  if (intent === "play") return true;
  if (intent === "pause") return false;
  return !reduce && !saveData;
}

const noSubscribe = () => () => {};

/** « Réduire les animations » pour décider du BALISAGE (libellé, icône
    Lire) : faux au rendu serveur comme au rendu d'hydratation, la vraie
    valeur juste après — useReducedMotion lit matchMedia dès le premier
    rendu client et ferait diverger l'hydratation. */
export function useReduceForMarkup(): boolean {
  const reduce = useReducedMotion();
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  return hydrated && !!reduce;
}

/** Carte quittée : une lecture demandée ne vaut que pour ce passage (sinon
    elle redeviendrait une lecture auto au retour) ; une pause reste. */
export function intentOnLeave(intent: PlayIntent): PlayIntent {
  return intent === "play" ? "auto" : intent;
}

export function MemberVideo({
  src,
  poster,
  alt,
  active,
  inView,
}: {
  src: string;
  poster?: string;
  alt: string;
  /** La carte occupe l'écran : c'est elle qui joue. */
  active: boolean;
  /** La carte est proche : on autorise le chargement (pas la lecture). */
  inView: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReduceForMarkup();
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [intent, setIntent] = useState<PlayIntent>("auto");
  // « économiseur de données » : on ne lance rien, l'image d'attente suffit
  const [saveData, setSaveData] = useState(false);

  // carte quittée : ajustement pendant le rendu, pas dans un effet
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setIntent(intentOnLeave(intent));
  }

  useEffect(() => {
    // différé d'un tick : jamais de setState synchrone dans un effet
    queueMicrotask(() => {
      try {
        setSaveData(
          window.matchMedia("(prefers-reduced-data: reduce)").matches,
        );
      } catch {
        /* média non reconnu par ce navigateur : on joue normalement */
      }
    });
  }, []);

  const canPlay = shouldPlay({ active, intent, reduce, saveData });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (canPlay) {
      void el.play().catch((e: unknown) => {
        // lecture auto refusée (mode économie d'énergie…) : le bouton doit
        // dire « Lire », pas « Mettre en pause »
        if ((e as { name?: string } | null)?.name === "NotAllowedError")
          setIntent("pause");
      });
    } else {
      el.pause();
      // la carte quittée repart du début : on ne reprend pas au milieu
      if (!active) el.currentTime = 0;
    }
  }, [canPlay, active]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    if (canPlay) {
      setIntent("pause");
      return;
    }
    setIntent("play");
    // lancée dans le geste lui-même : iOS l'accepte même sans lecture auto
    void ref.current?.play().catch(() => {});
  };

  if (failed)
    return poster ? (
      // la vidéo ne se lit pas : l'image d'attente vaut mieux qu'un vide
      <img
        src={poster}
        alt={alt}
        className="absolute inset-0 size-full object-cover"
      />
    ) : null;

  return (
    <div className="absolute inset-0 bg-black">
      {/* fond flouté : la vidéo verticale garde son cadrage sans crop dur */}
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.4]"
        />
      )}
      <video
        ref={ref}
        // inView seulement : le feed ne précharge que la carte suivante
        src={inView ? src : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload={inView ? "metadata" : "none"}
        aria-label={alt}
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-contain"
      />

      {/* lecture / pause : un vrai bouton plein cadre, atteignable au
          clavier ; le libellé dit l'action (pas d'aria-pressed en plus).
          L'icône Lire reste visible tant que rien ne tourne. */}
      {active && (
        <button
          type="button"
          data-cursor="media"
          onClick={togglePlay}
          aria-label={canPlay ? "Mettre la vidéo en pause" : "Lire la vidéo"}
          className="absolute inset-0 grid place-items-center focus-visible:outline-offset-[-4px]!"
        >
          {!canPlay && (
            <span className="grid size-16 place-items-center rounded-full bg-ink/60 backdrop-blur-md">
              <Play className="size-7 text-bone" />
            </span>
          )}
        </button>
      )}

      {/* son : le geste attendu sur ce format */}
      {active && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          style={{ top: "calc(env(safe-area-inset-top) + 7.5rem)" }}
          className="glass absolute right-[max(1rem,env(safe-area-inset-right))] z-20 grid size-11 place-items-center rounded-full text-bone active:scale-90 md:right-4"
        >
          {muted ? <Mute className="size-5" /> : <Volume className="size-5" />}
        </button>
      )}
    </div>
  );
}
