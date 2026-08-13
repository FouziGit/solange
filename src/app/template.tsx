"use client";

import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Global motion baseline + route transition.
 * MotionConfig reducedMotion="user" makes every Motion animation honor the
 * OS reduced-motion setting.
 *
 * The route fade-up is a **pure CSS** animation (`.page-enter`), NOT Motion.
 * This is load-bearing: a Motion `initial={{opacity:0}}` writes opacity:0 into
 * the SSR HTML and only clears it once the client JS runs — so any browser
 * where the bundle fails to boot (observed on iOS/desktop Safari) is left with
 * an invisible, black page. A CSS animation with `animation-fill-mode: both`
 * always ends visible and never depends on JS, so the content can never get
 * trapped at opacity:0. The keyed wrapper re-mounts per navigation (unlike
 * layout), which replays the CSS animation on each route change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <div key={pathname} className="page-enter">
        {children}
      </div>
    </MotionConfig>
  );
}
