/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Real photo layer with a graceful fallback: renders an <img> over whatever
 * generative gradient its parent already draws; on load error it removes
 * itself so the gradient shows through — the demo can never look broken.
 * Desaturated to keep the strict noir & blanc editorial ADN.
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
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      onError={() => setOk(false)}
      className={cn(
        "absolute inset-0 size-full object-cover grayscale contrast-[1.05]",
        className,
      )}
    />
  );
}
