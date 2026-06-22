"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { looks, feedTabs, followedHandles } from "@/lib/mock";
import { FeedCard } from "./FeedCard";
import { FeedTopBar } from "./FeedTopBar";
import { ChevronUp } from "../chrome/icons";

export function VideoFeed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<string>(feedTabs[0]);
  const reduce = useReducedMotion();

  // filter the feed by the active tab (functional FeedTopBar)
  const visibleLooks = useMemo(() => {
    if (tab === "Drops") return looks.filter((l) => l.badge === "DROP");
    if (tab === "Suivis")
      return looks.filter((l) => followedHandles.includes(l.creator.handle));
    return looks;
  }, [tab]);

  // switching tab changes the list — reset to the top of the new feed
  const handleTabChange = (next: string) => {
    if (next === tab) return;
    setTab(next);
    setActive(0);
    containerRef.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-index]"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setActive(Number(e.target.getAttribute("data-index")));
          }
        });
      },
      { root, threshold: [0.6] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [visibleLooks]);

  return (
    <>
      <FeedTopBar tab={tab} onTabChange={handleTabChange} />

      <div
        ref={containerRef}
        className="feed-scroll h-[100dvh] overflow-y-auto overflow-x-hidden"
      >
        {visibleLooks.map((look, i) => (
          <FeedCard
            key={look.id}
            look={look}
            index={i}
            active={i === active}
            inView={Math.abs(i - active) <= 1}
          />
        ))}
      </div>

      {/* desktop pagination rail */}
      <div className="fixed right-7 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-2.5 md:flex">
        {visibleLooks.map((look, i) => (
          <span
            key={look.id}
            className={`w-[3px] rounded-full transition-all duration-500 ${
              i === active ? "h-7 bg-bone" : "h-2.5 bg-bone/25"
            }`}
          />
        ))}
      </div>

      {/* scroll hint, fades after first scroll */}
      <AnimatePresence>
        {active === 0 && visibleLooks.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed bottom-8 left-1/2 z-40 hidden -translate-x-1/2 flex-col items-center gap-1 md:flex"
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={
                reduce
                  ? undefined
                  : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <ChevronUp className="size-5 text-bone/70" />
            </motion.div>
            <span className="overline text-[9px] text-bone/60">défile</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
