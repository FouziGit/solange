"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "@/components/chrome/icons";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  back,
  sectionNo,
}: {
  eyebrow: string;
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
            className="glass mb-4 grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="eyebrow text-sm text-bone/55"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
          className="font-editorial text-5xl font-semibold leading-[0.95] tracking-tight text-bone md:text-7xl"
        >
          {title}
        </motion.h1>
        <span className="mt-4 block h-px w-16 bg-bone/15" />
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
            <span className="overline text-[10px] text-bone/40">{sectionNo}</span>
          )}
          {right}
        </div>
      )}
    </header>
  );
}
