"use client";

import { cn, composition, gradientFor } from "@/lib/utils";
import { Photo } from "./Photo";

/**
 * Shared editorial media stack — the single source of truth for the luxury
 * "still" recipe duplicated across ProductCard and the ArticleDetail MediaTile.
 *
 * Layer order (bottom → top), all absolutely positioned to fill the parent:
 *   1. deterministic dark gradient base       (gradientFor)
 *   2. top key-light radial                    (composition-driven)
 *   3. draped-light blurred form               (composition-driven)
 *   4. centered Bodoni brand watermark + hairline rule (optional)
 *   5. real <Photo> overlay in natural colour (fails open to the gradient)
 *   6. bottom scrim gradient
 *   7. inset vignette
 *
 * The parent MUST be `relative overflow-hidden` and sized (aspect ratio /
 * explicit height) — LuxeMedia only paints inside it.
 */
export function LuxeMedia({
  seed,
  image,
  brand,
  small,
  eager,
  className,
  watermark = true,
}: {
  seed: string;
  image?: string;
  brand?: string;
  small?: boolean;
  eager?: boolean;
  className?: string;
  watermark?: boolean;
}) {
  const c = composition(seed);
  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{ background: gradientFor(seed) }}
    >
      {/* top key-light */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(56% 46% at ${30 + (c.h % 40)}% 24%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 40%, transparent 64%)`,
        }}
      />
      {/* draped-light form */}
      <div
        className="absolute rounded-full opacity-60 blur-2xl"
        style={{
          width: "70%",
          height: "58%",
          left: `${c.fx1}%`,
          top: `${24 + (c.h % 22)}%`,
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent 72%)",
        }}
      />
      {/* centered Bodoni brand watermark + hairline rule */}
      {watermark && brand && (
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="flex flex-col items-center text-center">
            <span
              className={`font-editorial italic leading-tight text-bone/30 ${small ? "text-lg" : "text-3xl md:text-5xl"}`}
            >
              {brand}
            </span>
            <span className="mt-2 h-px w-8 bg-bone/25" />
          </div>
        </div>
      )}
      {/* real photo (covers the gradient when it loads) */}
      {image && <Photo src={image} alt={brand ?? ""} eager={eager} />}
      {/* bottom scrim */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      {/* inset vignette */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 90px 20px rgba(0,0,0,0.55)" }}
      />
    </div>
  );
}
