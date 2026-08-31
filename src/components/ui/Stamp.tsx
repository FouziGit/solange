"use client";

import { motion, useReducedMotion } from "motion/react";
import { DUR, EASE } from "@/lib/utils";

/**
 * Le tampon — l'unique célébration de l'app (DA §9). Une étiquette carrée
 * double-filet qui s'applique d'un coup aux VRAIS jalons seulement : pièce
 * déposée, commande payée, look publié, pièce vendue. Pas de confetti, pas
 * de toast redondant. Sous prefers-reduced-motion : apparition simple.
 */
export function Stamp({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={
        reduce ? { opacity: 0 } : { opacity: 0, scale: 1.35, rotate: -7 }
      }
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -3 }}
      transition={{ duration: DUR.move, ease: EASE.luxe }}
      className="inline-block border-2 border-bone px-4 py-2"
    >
      <span className="block border border-bone/40 px-3 py-1.5">
        <span className="etiquette block text-[13px] leading-none text-bone">
          {children}
        </span>
      </span>
    </motion.span>
  );
}
