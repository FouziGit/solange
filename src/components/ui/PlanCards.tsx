"use client";

import { motion } from "motion/react";
import type { Plan } from "@/lib/mock";
import { EASE } from "@/lib/utils";
import { Check, Crown } from "@/components/chrome/icons";

/**
 * Premium plan grid as a small client island so the cards can animate in.
 * Strict noir & blanc; keeps the featured highlight.
 */
export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3 md:items-start">
      {plans.map((plan, i) => {
        const featured = plan.featured;
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{
              duration: 0.55,
              ease: EASE.luxe,
              delay: Math.min(i * 0.08, 0.3),
            }}
            className={`relative flex flex-col rounded-3xl border p-6 ${
              featured
                ? "border-bone bg-bone/[0.05] md:-mt-3 md:pb-8 md:pt-8"
                : "border-bone/12 bg-coal/40"
            }`}
          >
            {featured && (
              <span className="absolute right-5 top-6 inline-flex items-center gap-1 rounded-full bg-bone px-2.5 py-1 text-[10px] font-bold tracking-wide text-ink">
                <Crown className="size-3.5" /> POPULAIRE
              </span>
            )}

            <h2 className="font-editorial text-2xl font-semibold text-bone">
              {plan.name}
            </h2>
            <p className="mt-1 text-[12.5px] text-ash">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold tracking-tight text-bone">
                {plan.price}
              </span>
              {plan.id !== "free" && (
                <span className="text-sm text-ash">/ mois</span>
              )}
            </div>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-bone" />
                  <span className="text-bone/85">{f}</span>
                </li>
              ))}
            </ul>

            <button
              disabled={plan.id === "free"}
              className={`mt-7 w-full rounded-full py-3 text-sm font-semibold transition-transform active:scale-95 ${
                featured
                  ? "bg-bone text-ink"
                  : plan.id === "free"
                    ? "cursor-default border border-bone/15 text-ash"
                    : "border border-bone/30 text-bone hover:bg-bone/10"
              }`}
            >
              {plan.cta}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
