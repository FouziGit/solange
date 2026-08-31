"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { looks } from "@/lib/mock";
import { useStore } from "@/lib/store";
import type { ApiPost } from "@/lib/api";
import { FeedCard } from "./FeedCard";
import { MemberPostCard } from "./MemberPostCard";
import { ChevronUp } from "../chrome/icons";

export function VideoFeed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const { isBlocked, memberPosts, refreshPosts, postsError } = useStore();
  const visibleLooks = looks;

  /* Publications membres — insérées AVANT les looks (D-030). C'est
     précisément ce qui faisait « vibrer » le fil : quand la liste change
     après coup (revalidation réseau, ou arrivée de la session qui filtre
     les membres bloqués), des cartes apparaissent ou disparaissent
     AU-DESSUS de celle qu'on regarde. Le navigateur décale alors le
     défilement, le compteur de cartes change, l'observateur est recréé et
     l'animation d'échelle des cartes (0,95 ↔ 1) rejoue : ça saute.

     On fige donc la liste affichée, et on n'accepte une nouvelle version
     QUE lorsque la personne est revenue en haut du fil — là, un
     changement au-dessus ne déplace rien. */
  const incoming = memberPosts.filter((p) => !isBlocked(p.authorHandle));
  const [shownPosts, setShownPosts] = useState<ApiPost[]>(incoming);
  const sameList =
    shownPosts.length === incoming.length &&
    shownPosts.every((p, i) => p.id === incoming[i].id);

  useEffect(() => {
    if (sameList) return;
    const root = containerRef.current;
    // en haut du fil (ou fil pas encore parcouru) : on peut réordonner sans
    // rien bousculer
    if (!root || root.scrollTop < 8) {
      queueMicrotask(() => setShownPosts(incoming));
    }
    // sinon on garde la liste figée : elle sera reprise au prochain retour
    // en haut, plutôt que de faire sauter la lecture en cours
  }, [sameList, incoming]);

  const visiblePosts = shownPosts;
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
          <span className="etiquette text-[11px] text-bone/60">Fin du fil</span>
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

      {/* échec /api/posts : les publications membres manquent du fil — on
          l'annonce en chip discrète, le fil reste complet avec les looks */}
      {postsError && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
          style={{ top: "calc(env(safe-area-inset-top) + 7rem)" }}
        >
          <button
            type="button"
            onClick={() => void refreshPosts()}
            data-cursor="link"
            className="pointer-events-auto glass rounded-full px-4 py-2 text-[12px] font-medium text-bone active:scale-95"
          >
            Les publications n&apos;ont pas chargé · Réessayer
          </button>
        </div>
      )}

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
            <span className="etiquette text-[11px] text-bone/60">défile</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
