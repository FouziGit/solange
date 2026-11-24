"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DUR, EASE } from "@/lib/utils";
import { LogoMark } from "./Brandmark";

/**
 * Écran de lancement de l'app installée : fond uni et émergence du logo,
 * 0,9 s au plus, une fois par session. Un toucher le passe. Monté par
 * AuthGate par-dessus l'app, qui charge en dessous pendant ce temps.
 */
export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [sortie, setSortie] = useState(false);

  /* 660 ms pleins, puis 240 ms de fondu pendant lesquels l'écran ne capte
     plus les touchers. Sous « Réduire les animations » : pas de fondu. */
  useEffect(() => {
    const ids = reduce
      ? [window.setTimeout(onDone, 660)]
      : [
          window.setTimeout(() => setSortie(true), 660),
          window.setTimeout(onDone, 900),
        ];
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [onDone, reduce]);

  return (
    <div
      role="presentation"
      onClick={onDone}
      className={`theme-dark fixed inset-0 z-[110] grid place-items-center bg-noir transition-opacity duration-[240ms] ease-in ${
        sortie ? "pointer-events-none opacity-0" : ""
      }`}
    >
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DUR.set, ease: EASE.luxe }}
        >
          <LogoMark variant="white" className="size-28" />
        </motion.div>
        <p className="font-display mt-7 pl-[0.42em] text-[1.5rem] font-light tracking-[0.42em] text-bone">
          SOLANGE
        </p>
      </div>
    </div>
  );
}
