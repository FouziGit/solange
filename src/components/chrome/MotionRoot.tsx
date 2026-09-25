"use client";

import { MotionConfig } from "motion/react";

/**
 * Racine Motion de l'app, montée UNE fois dans layout.tsx autour de tout
 * le contenu du <body>. `reducedMotion="user"` fait respecter le réglage
 * « Réduire les animations » à toute animation Motion : pages, mais aussi
 * écran d'inscription (AuthGate), barre d'onglets, SideNav et feuilles (le
 * portail de Sheet garde ce contexte React).
 *
 * Ce réglage coupe les déplacements, échelles et animations de layout,
 * pas l'opacité ni `filter` (un flou reste à couper chez l'appelant, sous
 * useReducedMotion), ni `useSpring` : CustomCursor s'éteint lui-même.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
