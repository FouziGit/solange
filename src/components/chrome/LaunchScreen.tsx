"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LogoMark } from "./Brandmark";
import { MeshBackground } from "./MeshBackground";

/** Durée d'affichage de l'écran de lancement (ms). */
const HOLD_MS = 2200;

/**
 * Écran de lancement de l'app mobile : le maillage 3D filaire et le logo,
 * à chaque ouverture (une fois par session). Un toucher le passe. Monté
 * par AuthGate par-dessus l'app, qui charge en dessous pendant ce temps.
 */
export function LaunchScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = window.setTimeout(onDone, reduce ? 900 : HOLD_MS);
    return () => window.clearTimeout(id);
  }, [onDone, reduce]);

  return (
    <motion.div
      role="presentation"
      onClick={onDone}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="theme-dark fixed inset-0 z-[110] grid place-items-center bg-noir"
    >
      <MeshBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 34%, rgba(0,0,0,.72) 100%), linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.85) 100%)",
        }}
      />
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <LogoMark variant="white" className="size-28" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-display mt-7 pl-[0.42em] text-[1.5rem] font-light tracking-[0.42em] text-bone"
        >
          SOLANGE
        </motion.p>
      </div>
    </motion.div>
  );
}
