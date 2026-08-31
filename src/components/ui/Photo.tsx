/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Real photo layer with a graceful fallback: renders an <img> over whatever
 * generative gradient its parent already draws; on load error it removes
 * itself so the gradient shows through — the demo can never look broken.
 * Media renders in natural colour — the monochrome treatment lives in the UI
 * chrome only, not on photography.
 */
export function Photo({
  src,
  alt = "",
  className,
  eager,
}: {
  src: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  // Track the src that failed rather than a boolean, so a recycled <Photo>
  // (e.g. a re-keyed card swapping items, or src changing) re-attempts the
  // new image without an effect — visibility is derived, not synchronised.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return null;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
