import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared easing curves for Motion transitions across the app. */
export const EASE = {
  luxe: [0.16, 1, 0.3, 1],
  silk: [0.22, 1, 0.36, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

/** 24300 -> "24,3 k" · 1240000 -> "1,2 M" (FR formatting) */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} k`;
  return String(n);
}

/** 129 -> "129 €" · 24.99 -> "24,99 €" */
export function euro(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
  return `${s} €`;
}

/** Stable 32-bit FNV-1a hash of a string. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function initials(name: string): string {
  const parts = name.replace(/^@/, "").split(/[\s.]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Deterministic monochrome composition spec derived from a seed.
 * Stays strictly grayscale (brand discipline) and drives feed variety:
 * light placement, headline tilt/offset, and a scale tier.
 */
export function composition(seed: string) {
  const h = hash(seed);
  const fx1 = 12 + (h % 30);
  const fy1 = 8 + ((h >> 3) % 30);
  const fx2 = 60 + ((h >> 6) % 35);
  const fy2 = 55 + ((h >> 9) % 40);
  const rot = ((h >> 7) % 24) - 12; // -12..12deg headline tilt
  const lift = (h >> 11) % 28; // headline vertical offset
  const big = (h >> 3) % 2 === 0; // scale tier for feed variety
  return { h, fx1, fy1, fx2, fy2, rot, lift, big };
}

/** A deterministic dark gradient string for avatars/swatches. */
export function gradientFor(seed: string): string {
  const h = hash(seed);
  const a = h % 360;
  const l1 = 14 + (h % 8);
  const l2 = 4 + ((h >> 4) % 6);
  return `linear-gradient(${a}deg, hsl(${a},6%,${l1}%), hsl(${(a + 40) % 360},5%,${l2}%))`;
}

/** SOLANGE degressive commission (from the business plan). */
export function commissionRate(price: number): number {
  if (price < 200) return 0.04;
  if (price < 500) return 0.035;
  if (price < 1000) return 0.025;
  return 0.02;
}

export function commission(price: number) {
  const rate = commissionRate(price);
  const fee = Math.round(price * rate * 100) / 100;
  return { rate, fee, net: Math.round((price - fee) * 100) / 100 };
}
