/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { announce } from "@/lib/announce";
import { ChevronRight } from "../chrome/icons";

/** Photo affichée d'après le défilement horizontal, bornée à la galerie. */
export function slideAt(scrollLeft: number, width: number, count: number) {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

/** Précédente / suivante en boucle : aucun bouton ne devient inerte sous
    le doigt ou le focus. */
export function wrapSlide(i: number, count: number) {
  return count > 0 ? ((i % count) + count) % count : 0;
}

/** « Photo 2 sur 4 » — lu tel quel, là où « 2/4 » se lit « deux quarts ». */
export function photoLabel(i: number, count: number) {
  return `Photo ${i + 1} sur ${count}`;
}

/**
 * Instagram-style image carousel INSIDE a feed post. Horizontal scroll-snap of
 * multiple images, with a "n/N" counter and dot indicators. Lives inside the
 * vertical TikTok feed: horizontal swipes page the carousel, vertical swipes
 * still scroll the feed (nested native scroll containers, no touch-action lock).
 * Each slide shows the full image (object-contain) over a blurred fill so
 * portrait product shots are never awkwardly cropped.
 * Le balayage n'est pas le seul chemin : boutons précédent / suivant et
 * pastilles « Photo i sur N » (44 px) pour le clavier, VoiceOver et la
 * souris.
 */
export function CarouselMedia({
  images,
  title,
  house,
}: {
  images: string[];
  title: string;
  house: string;
}) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const count = images.length;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = slideAt(el.scrollLeft, el.clientWidth, count);
    if (i !== index) setIndex(i);
  };

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({
      left: i * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const step = (delta: number) => {
    const next = wrapSlide(index + delta, count);
    goTo(next);
    announce(photoLabel(next, count));
  };

  return (
    <div
      role="group"
      aria-roledescription="carrousel"
      aria-label={`Photos · ${title}`}
      className="absolute inset-0 bg-black"
    >
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [overscroll-behavior-x:contain]"
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden"
          >
            {/* blurred fill so the whole garment shows without a hard crop */}
            <img
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.45]"
            />
            {/* contained hero */}
            <img
              src={src}
              alt={`${house} — ${title}, ${photoLabel(i, count).toLowerCase()}`}
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 size-full object-contain"
            />
          </div>
        ))}
      </div>

      {/* legibility scrims — same as the single-media layer */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />

      {/* "n/N" counter — top-left, clears the feed top bar. Visuel seul :
          l'alt de chaque photo et les pastilles portent déjà la position. */}
      <div
        aria-hidden="true"
        style={{ top: "calc(env(safe-area-inset-top) + 5.25rem)" }}
        className="pointer-events-none absolute left-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-bone backdrop-blur"
      >
        {index + 1}/{count}
      </div>

      {/* précédente · pastilles · suivante — sous la barre du haut (le
          sélecteur Looks / Pièces recouvrait les pastilles), au centre
          pour ne croiser ni la légende ni le rail. Cibles de 44 px. */}
      <div
        style={{ top: "calc(env(safe-area-inset-top) + 7.5rem)" }}
        className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
      >
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Photo précédente"
          className="pointer-events-auto grid size-11 place-items-center text-bone"
        >
          <span className="grid size-8 place-items-center rounded-full bg-black/55 backdrop-blur">
            <ChevronRight className="size-4 rotate-180" />
          </span>
        </button>
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={photoLabel(i, count)}
            aria-current={i === index ? "true" : undefined}
            className="pointer-events-auto grid size-11 place-items-center"
          >
            <span
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-4 bg-bone" : "w-1.5 bg-bone/45"
              }`}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Photo suivante"
          className="pointer-events-auto grid size-11 place-items-center text-bone"
        >
          <span className="grid size-8 place-items-center rounded-full bg-black/55 backdrop-blur">
            <ChevronRight className="size-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
