/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

/**
 * Instagram-style image carousel INSIDE a feed post. Horizontal scroll-snap of
 * multiple images, with a "n/N" counter and dot indicators. Lives inside the
 * vertical TikTok feed: horizontal swipes page the carousel, vertical swipes
 * still scroll the feed (nested native scroll containers, no touch-action lock).
 * Each slide shows the full image (object-contain) over a blurred fill so
 * portrait product shots are never awkwardly cropped.
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

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <div className="absolute inset-0 bg-black">
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
              alt={`${house} — ${title} (${i + 1}/${images.length})`}
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

      {/* "n/N" counter — top-right, clears the feed top bar */}
      <div
        style={{ top: "calc(env(safe-area-inset-top) + 5.25rem)" }}
        className="pointer-events-none absolute right-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-bone backdrop-blur"
      >
        {index + 1}/{images.length}
      </div>

      {/* dot indicators — centered in the top band, under the feed tabs, so
          they never collide with the caption / action rail. */}
      <div
        style={{ top: "calc(env(safe-area-inset-top) + 5.4rem)" }}
        className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center gap-1.5"
      >
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-4 bg-bone" : "w-1.5 bg-bone/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
