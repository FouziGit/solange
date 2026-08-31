"use client";

/* ============================================================
   SOLANGE — vidéo d'une publication membre (lot 5).
   Lecture auto muette, son au tap, boucle. L'image d'attente
   s'affiche d'abord : jamais de trou noir. Ne charge la vidéo que
   si la carte est proche (préchargement de la suivante seulement).
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Mute, Volume, Play } from "../chrome/icons";

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
  const reduce = useReducedMotion();
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  // « économiseur de données » : on ne lance rien, l'image d'attente suffit
  const [saveData, setSaveData] = useState(false);

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

  const canPlay = active && !reduce && !saveData && !paused;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (canPlay) {
      // autoplay refusé (politique du navigateur) : le poster reste, pas d'erreur
      void el.play().catch(() => {});
    } else {
      el.pause();
      // la carte quittée repart du début : on ne reprend pas au milieu
      if (!active) el.currentTime = 0;
    }
  }, [canPlay, active]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

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
        onClick={() => setPaused((p) => !p)}
        className="absolute inset-0 size-full object-contain"
      />

      {/* pause visible : on doit comprendre pourquoi ça ne bouge plus */}
      {paused && active && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-ink/60 backdrop-blur-md">
            <Play className="size-7 text-bone" />
          </span>
        </span>
      )}

      {/* son : le geste attendu sur ce format */}
      {active && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          aria-pressed={!muted}
          style={{ top: "calc(env(safe-area-inset-top) + 7.5rem)" }}
          className="glass absolute right-4 z-20 grid size-10 place-items-center rounded-full text-bone active:scale-90"
        >
          {muted ? <Mute className="size-5" /> : <Volume className="size-5" />}
        </button>
      )}
    </div>
  );
}
