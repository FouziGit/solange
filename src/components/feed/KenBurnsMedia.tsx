/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { composition } from "@/lib/utils";

// rotated per-card so consecutive stills never read with the same kicker
const SEASONS = [
  "Automne · Hiver 26",
  "Pré-collection 26",
  "Capsule Archive",
  "Édition limitée",
  "Hiver 26",
  "Collection permanente",
];

/**
 * Luxury B&W editorial film still, fully offline, no image host.
 * A studio cyclorama + key light + draped-light forms + grain, with a
 * Didone campaign title. Slowly Ken-Burns'd while the card is active so it
 * reads as a moving fashion film, not a flat gradient. The title is composed
 * from the seed (tilt / vertical lift / scale tier / alignment) so no two
 * frames feel identical.
 */
export function KenBurnsMedia({
  seed,
  title,
  house,
  index,
  active,
  paused,
  image,
}: {
  seed: string;
  title: string;
  house: string;
  index: number;
  active: boolean;
  paused: boolean;
  image?: string;
}) {
  const c = composition(seed);
  const [imgOk, setImgOk] = useState(true);
  const showPhoto = Boolean(image) && imgOk;
  const num = String(index + 1).padStart(2, "0");
  const sx = 30 + (c.h % 40); // key-light x
  const sy = 18 + ((c.h >> 4) % 22); // key-light y

  // seed-driven title composition (kills the identical-frame feel)
  const titleRot = c.rot * 0.4; // subtle -4.8..4.8deg headline tilt
  const titleTop = 28 + (c.lift % 18); // ~28..46% from top
  const titleScale = c.big ? 1 : 0.86; // 2-step scale tier
  const leftAligned = index % 2 === 1; // alternate center vs left layout
  const season = SEASONS[index % SEASONS.length];

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* moving composition */}
      <div
        className={`absolute inset-0 ${active && !paused ? "kenburns" : ""}`}
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {showPhoto ? (
          /* real B&W editorial photo — hero layer */
          <img
            src={image}
            alt={`${house} — ${title}`}
            draggable={false}
            onError={() => setImgOk(false)}
            className="absolute inset-0 size-full object-cover grayscale contrast-[1.04] brightness-[0.78]"
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

      {/* cinematic light sweep — active only */}
      {active && !paused && <div className="sweep" />}

      {/* editorial campaign typography — seed-composed per card */}
      <motion.div
        className={`pointer-events-none absolute inset-x-0 flex flex-col px-8 ${
          leftAligned ? "items-start text-left" : "items-center text-center"
        }`}
        style={{ top: `${titleTop}%` }}
        initial={false}
        animate={{ opacity: active ? 1 : 0.35, y: active ? 0 : 10 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="overline mb-3 text-[10px] text-bone/70">
          Solange · {season}
        </span>
        <h2
          className="font-editorial font-semibold leading-[0.9] tracking-tight text-bone drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]"
          style={{
            fontSize: `clamp(3.5rem, 15vw, 6rem)`,
            transform: `rotate(${titleRot}deg) scale(${titleScale})`,
            transformOrigin: leftAligned ? "left center" : "center",
          }}
        >
          {title}
        </h2>
        <span className="mt-4 h-px w-12 bg-bone/40" />
        <span className="overline mt-3 text-[9px] text-bone/55">
          {house} · Look Nº{num}
        </span>
      </motion.div>

      {/* legibility scrims */}
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
