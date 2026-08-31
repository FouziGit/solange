"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

const QUERY = "(hover: hover) and (pointer: fine)";

/** Reads whether this is a precise-pointer desktop, the canonical (no
 *  setState-in-effect) way — keeps SSR snapshot stable, then syncs on client. */
function useFinePointer() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * Editorial custom cursor: a precise volt dot + a lagging bone ring that
 * inverts via mix-blend-difference. Grows over interactive targets and shows
 * a "VOIR" label over media. Desktop-only.
 */
export function CustomCursor() {
  const enabled = useFinePointer();
  const [variant, setVariant] = useState<"default" | "link" | "media">(
    "default",
  );
  const [hidden, setHidden] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 320, damping: 28, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 320, damping: 28, mass: 0.6 });

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("cursor-ready");

    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-cursor='media']")) setVariant("media");
      else if (el?.closest("a,button,[role='button'],[data-cursor='link']"))
        setVariant("link");
      else setVariant("default");
    };
    const leave = () => setHidden(true);
    const enter = () => setHidden(false);

    window.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    document.addEventListener("mouseenter", enter);
    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseenter", enter);
      document.documentElement.classList.remove("cursor-ready");
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const ringSize = variant === "media" ? 72 : variant === "link" ? 52 : 30;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      {/* lagging ring (inverts everything beneath) */}
      <motion.div
        className="absolute top-0 left-0 grid place-items-center rounded-full"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          mixBlendMode: "difference",
        }}
      >
        <motion.div
          className="grid place-items-center rounded-full border border-bone"
          animate={{ width: ringSize, height: ringSize }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        >
          {variant === "media" && (
            <span className="etiquette text-[8px] text-bone">voir</span>
          )}
        </motion.div>
      </motion.div>

      {/* precise dot */}
      <motion.div
        className="absolute top-0 left-0 size-1.5 rounded-full bg-bone"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
        animate={{ scale: variant === "default" ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}
