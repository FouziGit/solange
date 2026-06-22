"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import type { Look } from "@/lib/mock";
import { KenBurnsMedia } from "./KenBurnsMedia";
import { ProductHotspots } from "./ProductHotspots";
import { CreatorHeader } from "./CreatorHeader";
import { ActionRail } from "./ActionRail";
import { ShopTheLook } from "./ShopTheLook";
import { Heart, Play, Music, Pin, Mute, Volume } from "../chrome/icons";

type Burst = { id: number; x: number; y: number };

const group: Variants = {
  hide: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const item: Variants = {
  hide: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function FeedCard({
  look,
  active,
  index,
  inView,
}: {
  look: Look;
  active: boolean;
  index: number;
  inView: boolean;
}) {
  const reduce = useReducedMotion();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstId = useRef(0);

  const spawnHeart = (x: number, y: number) => {
    if (reduce) return; // no burst animation under reduced-motion
    const id = burstId.current++;
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), 800);
  };

  const onMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setLiked(true);
      spawnHeart(x, y);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        setPaused((p) => !p);
      }, 230);
    }
  };

  const openShop = (productId: string) => {
    setHighlight(productId);
    setShopOpen(true);
  };

  return (
    <section
      data-index={index}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      <motion.div
        animate={{
          scale: reduce ? 1 : active ? 1 : 0.95,
          opacity: active ? 1 : 0.5,
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="stage relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-[30px] md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
      >
        {/* Off-window cards drop everything but a flat black panel of the same
            size — no media, animation or blur paints offscreen. */}
        {!inView ? (
          <div aria-hidden="true" className="absolute inset-0 bg-black" />
        ) : (
          <>
            {/* media + tap layer */}
            <div
              data-cursor="media"
              onClick={onMediaClick}
              className="absolute inset-0"
            >
              <KenBurnsMedia
                seed={look.seed}
                title={look.title}
                house={look.products[0]?.brand ?? look.creator.name}
                index={index}
                active={active}
                paused={paused}
              />
            </div>

            {/* shoppable hotspots */}
            {active && (
              <ProductHotspots products={look.products} onOpen={openShop} />
            )}

            {/* pause overlay */}
            <AnimatePresence>
              {paused && active && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="grid size-20 place-items-center rounded-full bg-black/40 backdrop-blur-md ring-1 ring-bone/15">
                    <Play className="size-9 text-bone" />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* double-tap heart bursts */}
            <AnimatePresence>
              {bursts.map((b) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0.9, scale: 0.4, y: 0, rotate: -10 }}
                  animate={{ opacity: 0, scale: 1.5, y: -120, rotate: 6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: b.x,
                    top: b.y,
                    translateX: "-50%",
                    translateY: "-50%",
                  }}
                >
                  <Heart filled className="size-16 text-bone drop-shadow-lg" />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* top: creator + mute — clears the floating feed top bar via safe-area */}
            <motion.div
              initial={false}
              animate={{ opacity: active ? 1 : 0, y: active ? 0 : -12 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: active ? 0.1 : 0,
              }}
              style={{
                paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)",
              }}
              className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4"
            >
              <CreatorHeader
                creator={look.creator}
                following={following}
                onToggleFollow={() => setFollowing((f) => !f)}
              />
              {/* >=44px tap target around the mute glyph */}
              <button
                onClick={() => setMuted((m) => !m)}
                className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-full text-bone transition-transform active:scale-90"
                aria-label={muted ? "Activer le son" : "Couper le son"}
                aria-pressed={!muted}
              >
                <span className="grid size-9 place-items-center rounded-full glass">
                  {muted ? (
                    <Mute className="size-4" />
                  ) : (
                    <Volume className="size-4" />
                  )}
                </span>
              </button>
            </motion.div>

            {/* action rail — bottom clears the floating tab bar + caption block */}
            <motion.div
              initial={false}
              animate={{ opacity: active ? 1 : 0, x: active ? 0 : 18 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: active ? 0.18 : 0,
              }}
              style={{ bottom: "calc(var(--tabbar-clearance) + 4.5rem)" }}
              className="absolute right-3 z-20 md:!bottom-40"
            >
              <ActionRail
                liked={liked}
                saved={saved}
                likes={look.likes}
                comments={look.comments}
                shares={look.shares}
                onLike={() => setLiked((l) => !l)}
                onSave={() => setSaved((s) => !s)}
                creatorSeed={look.creator.seed}
                creatorName={look.creator.name}
                active={active}
              />
            </motion.div>

            {/* bottom: caption, tags, sound, shop — staggered reveal.
            Bottom padding clears the floating mobile tab bar (0 at md). */}
            <motion.div
              variants={group}
              initial="hide"
              animate={active ? "show" : "hide"}
              style={{
                paddingBottom: "calc(var(--tabbar-clearance) + 1rem)",
              }}
              className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-4 pr-20 md:!pb-9"
            >
              {look.badge && (
                <motion.span
                  variants={item}
                  className="inline-flex items-center gap-2 rounded-full border border-bone/25 px-3 py-1 text-[10px] font-semibold tracking-[0.24em] text-bone/80"
                >
                  <span className="size-1.5 rounded-full bg-bone" />
                  {look.badge}
                </motion.span>
              )}

              <motion.div
                variants={item}
                className="flex items-center gap-1.5 text-[11px] text-ash"
              >
                <Pin className="size-3.5" />
                {look.location}
              </motion.div>

              <motion.p
                variants={item}
                className="max-w-[34ch] text-[13.5px] leading-relaxed text-bone/95"
              >
                {look.caption}
              </motion.p>

              <motion.div
                variants={item}
                className="flex flex-wrap gap-x-2 gap-y-1"
              >
                {look.tags.map((t) => (
                  <span key={t} className="text-[12px] font-medium text-ash">
                    {t}
                  </span>
                ))}
              </motion.div>

              <motion.div
                variants={item}
                className="flex items-center gap-2 text-[11px] text-bone/75"
              >
                <Music className="size-3.5 shrink-0" />
                <div className="relative w-44 overflow-hidden whitespace-nowrap">
                  <div className="marquee inline-block">
                    <span className="pr-8">{look.soundtrack}</span>
                    <span className="pr-8">{look.soundtrack}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={item}>
                <ShopTheLook
                  products={look.products}
                  open={shopOpen}
                  onOpenChange={(v) => {
                    setShopOpen(v);
                    if (!v) setHighlight(null);
                  }}
                  highlightId={highlight}
                />
              </motion.div>
            </motion.div>

            {/* progress bar */}
            <div className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-bone/10">
              <motion.div
                key={`${look.id}-${active}-${paused}`}
                className="h-full bg-bone"
                initial={{ width: 0 }}
                animate={{ width: active && !paused ? "100%" : 0 }}
                transition={{
                  duration: active && !paused ? 13 : 0.25,
                  ease: "linear",
                }}
              />
            </div>
          </>
        )}
      </motion.div>
    </section>
  );
}
