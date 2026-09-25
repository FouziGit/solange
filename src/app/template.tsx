"use client";

import { usePathname } from "next/navigation";

/**
 * Route transition.
 * Le MotionConfig reducedMotion="user" vit désormais dans MotionRoot
 * (layout.tsx), autour de TOUT le body : ici, il ne couvrait que les pages,
 * pas l'écran d'inscription, la barre d'onglets ni la SideNav.
 *
 * The route fade-up is a **pure CSS** animation (`.page-enter`), NOT Motion.
 * This is load-bearing: a Motion `initial={{opacity:0}}` writes opacity:0 into
 * the SSR HTML and only clears it once the client JS runs — so any browser
 * where the bundle fails to boot (observed on iOS/desktop Safari) is left with
 * an invisible, black page. A CSS animation (`animation-fill-mode: backwards`)
 * always ends visible and never depends on JS, so the content can never get
 * trapped at opacity:0. The keyed wrapper re-mounts per navigation (unlike
 * layout), which replays the CSS animation on each route change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
