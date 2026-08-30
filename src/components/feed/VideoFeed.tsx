"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { looks } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { FeedCard } from "./FeedCard";
import { MemberPostCard } from "./MemberPostCard";
import { ChevronUp } from "../chrome/icons";

export function VideoFeed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const { isBlocked, memberPosts, refreshPosts } = useStore();
  const visibleLooks = looks;

  // Publications membres — lues depuis le store, PRÉCHARGÉES pendant le
  // splash : le fil monte complet, sans insertion tardive qui ferait sauter
  // le scroll-snap. La revalidation au montage rattrape un post publié entre
  // temps ; en cas d'échec réseau le fil reste complet avec les looks.
  const visiblePosts = memberPosts.filter((p) => !isBlocked(p.authorHandle));
  const total = visiblePosts.length + visibleLooks.length;

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

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
    // re-observe quand des publications membres arrivent (ou sont filtrées) :
    // de nouvelles sections [data-index] apparaissent dans le scroll
  }, [total]);

  return (
    <>
      <div
        ref={containerRef}
        className="feed-scroll h-[100dvh] overflow-y-auto overflow-x-hidden"
      >
        {visiblePosts.map((post, i) => (
          <MemberPostCard
            key={post.id}
            post={post}
            index={i}
            active={i === active}
            inView={Math.abs(i - active) <= 1}
          />
        ))}

        {visibleLooks.map((look, i) => {
          const idx = visiblePosts.length + i;
          return (
            <FeedCard
              key={look.id}
              look={look}
              index={idx}
              active={idx === active}
              inView={Math.abs(idx - active) <= 1}
            />
          );
        })}

        {/* end-of-feed marker after the last look */}
        <div className="feed-snap flex h-[60dvh] flex-col items-center justify-center gap-3 px-10 text-center">
          <span className="h-px w-10 bg-bone/30" />
          <span className="overline text-[11px] text-bone/60">Fin du fil</span>
          <p className="max-w-[24ch] text-[12.5px] text-ash/80">
            Tu as tout vu. Remonte pour revoir les looks.
          </p>
        </div>
      </div>

      {/* desktop pagination rail — publications membres + looks */}
      <div className="fixed right-7 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-2.5 md:flex">
        {[
          ...visiblePosts.map((p) => p.id),
          ...visibleLooks.map((l) => l.id),
        ].map((id, i) => (
          <span
            key={id}
            className={`w-[3px] rounded-full transition-all duration-500 ${
              i === active ? "h-7 bg-bone" : "h-2.5 bg-bone/25"
            }`}
          />
        ))}
      </div>

      {/* scroll hint, fades after first scroll */}
      <AnimatePresence>
        {active === 0 && total > 1 && (
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
            <span className="overline text-[11px] text-bone/60">défile</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
