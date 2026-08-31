/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { composition } from "@/lib/utils";

/**
 * Luxury editorial media layer, fully offline. Real photo / runway clip when
 * available, otherwise a studio cyclorama + key light + draped-light forms,
 * slowly Ken-Burns'd while the card is active so it reads as a moving fashion
 * film rather than a flat gradient. No overlaid campaign type — the feed is
 * visuals-first (quiet luxury); the image carries the card on its own.
 */
export function KenBurnsMedia({
  seed,
  title,
  house,
  active,
  paused,
  image,
  video,
  poster,
  inView = true,
}: {
  seed: string;
  title: string;
  house: string;
  active: boolean;
  paused: boolean;
  image?: string;
  video?: string;
  poster?: string;
  /** La carte est visible ou juste à côté : seule celle-là charge sa vidéo. */
  inView?: boolean;
}) {
  const reduce = useReducedMotion();
  const c = composition(seed);
  const [imgOk, setImgOk] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = Boolean(video) && videoOk;
  const showPhoto = Boolean(image) && imgOk;

  // drive playback off active/paused (reduced-motion never autoplays → poster)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active && !paused && !reduce) {
      // autoplay refusé par le navigateur : voulu — le poster reste affiché
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active, paused, reduce, showVideo]);
  const sx = 30 + (c.h % 40); // key-light x
  const sy = 18 + ((c.h >> 4) % 22); // key-light y

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {showVideo ? (
        /* Clip de défilé — pas de dérive ken-burns, l'image bouge déjà.
           Muted + playsInline sont indispensables à la lecture auto iOS.

           L'image d'attente est une VRAIE <img> posée DESSOUS, et non le
           seul attribut `poster` : pendant que la source s'attache et se
           charge, `poster` n'est pas fiable (constaté sur iPhone — la
           carte restait noire le temps du chargement). L'image, elle,
           peint dès qu'elle arrive ; la vidéo la recouvre ensuite. */
        <>
          {poster && (
            <img
              src={poster}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading={active ? "eager" : "lazy"}
              fetchPriority={active ? "high" : "auto"}
              decoding="async"
              className="absolute inset-0 size-full object-cover brightness-[0.92]"
            />
          )}
          {/* la balise vidéo n'existe que sur la carte visible ou voisine :
              ailleurs, l'image d'attente suffit et rien ne se télécharge */}
          {inView && (
            <video
              ref={videoRef}
              /* Le src n'est posé QUE sur la carte visible ou voisine : sinon le
             navigateur téléchargeait les métadonnées des 8 clips au premier
             rendu — ~900 Ko chacun. Mesuré : c'était l'élément LCP du feed
             (9,4 s en 4G bridée) alors que son poster ne pèse que 62 Ko. */
              src={video}
              muted
              loop
              playsInline
              /* la carte active a besoin des métadonnées pour démarrer vite ;
             les voisines attendent d'être atteintes */
              preload={active ? "metadata" : "none"}
              onError={() => setVideoOk(false)}
              /* fond transparent : tant qu'il n'y a pas d'image décodée, on
             voit l'<img> du dessous plutôt qu'un rectangle noir */
              className="absolute inset-0 size-full bg-transparent object-cover brightness-[0.92]"
            />
          )}
        </>
      ) : (
        /* moving composition — will-change only while actually animating */
        <div
          className={`absolute inset-0 ${active && !paused ? "kenburns" : ""}`}
          style={{
            animationPlayState: paused ? "paused" : "running",
            willChange: active && !paused ? "transform" : "auto",
          }}
        >
          {showPhoto ? (
            /* real B&W editorial photo — hero (LCP) layer. The active card
             fetches eagerly at high priority; neighbours stay lazy. */
            <img
              src={image}
              alt={`${house} — ${title}`}
              draggable={false}
              onError={() => setImgOk(false)}
              loading={active ? "eager" : "lazy"}
              fetchPriority={active ? "high" : "auto"}
              decoding="async"
              className="absolute inset-0 size-full object-cover brightness-[0.9]"
            />
          ) : (
            <>
              {/* studio cyclorama sweep */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(177deg, #272727 0%, #19191a 38%, #0a0a0b 72%, #050505 100%)",
                }}
              />
              {/* key light */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(46% 42% at ${sx}% ${sy}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 38%, transparent 64%)`,
                }}
              />
              {/* fill light */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(38% 36% at ${c.fx2}% ${c.fy2}%, rgba(255,255,255,0.08) 0%, transparent 60%)`,
                }}
              />
              {/* draped-light forms (silk / smoke under the key light) */}
              <div
                className="absolute rounded-full opacity-70 blur-2xl"
                style={{
                  width: "70%",
                  height: "55%",
                  left: `${c.fx1}%`,
                  top: `${20 + (c.h % 24)}%`,
                  background:
                    "radial-gradient(closest-side, rgba(255,255,255,0.13), transparent 72%)",
                }}
              />
              <div
                className="absolute rounded-full opacity-60 blur-2xl"
                style={{
                  width: "55%",
                  height: "70%",
                  left: `${35 + ((c.h >> 6) % 30)}%`,
                  top: `${38 + ((c.h >> 8) % 30)}%`,
                  background:
                    "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 70%)",
                }}
              />
              {/* central "subject" glow */}
              <div
                className="absolute left-1/2 top-[46%] h-[62%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-50 blur-3xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(255,255,255,0.12), transparent 75%)",
                }}
              />
            </>
          )}
        </div>
      )}

      {/* cinematic light sweep — active only */}
      {active && !paused && <div className="sweep" />}

      {/* legibility scrims — painted UNDER the campaign title so they never
          occlude it. The title block follows in DOM order = renders on top. */}
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 180px 40px rgba(0,0,0,0.7)" }}
      />
    </div>
  );
}
