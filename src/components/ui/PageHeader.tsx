"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "@/components/chrome/icons";

/** Canonical H1 scale — single source of truth for page titles across views.
 *  Montserrat (font-display) for a minimalist-luxe, modern feel. */
export const PAGE_TITLE =
  "font-display text-[2.7rem] font-bold uppercase leading-[0.95] tracking-tight text-bone md:text-6xl";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  back,
  sectionNo,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Optional back-link href — renders a glass ArrowLeft button before the eyebrow. */
  back?: string;
  /** Optional right-aligned section number (e.g. "Nº 04"). */
  sectionNo?: string;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-4 md:mb-10">
      <div className="min-w-0">
        {back && (
          <Link
            href={back}
            data-cursor="link"
            aria-label="Retour"
            className="glass mb-4 grid size-11 place-items-center rounded-none text-bone transition-transform active:scale-90"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        {eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="eyebrow text-sm text-bone/55"
          >
            {eyebrow}
          </motion.p>
        )}
        <motion.h1
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
          className={PAGE_TITLE}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 max-w-md text-sm leading-relaxed text-ash"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {(right || sectionNo) && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {sectionNo && (
            <span className="overline text-[11px] text-bone/40">
              {sectionNo}
            </span>
          )}
          {right}
        </div>
      )}
    </header>
  );
}
