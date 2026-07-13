import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The real SOLANGE brandmark — the "S" swirl PNG from /branding (512px,
 * transparent). `variant="white"` on dark surfaces (the app is dark-native),
 * `variant="black"` reserved for bone/light surfaces. Size via className.
 */
export function LogoMark({
  variant = "white",
  className,
}: {
  variant?: "white" | "black";
  className?: string;
}) {
  return (
    <Image
      src={`/branding/logo-${variant}.png`}
      alt="SOLANGE"
      width={512}
      height={512}
      draggable={false}
      className={cn("block select-none object-contain", className)}
    />
  );
}

/**
 * The SOLANGE "S" monogram — a couture high-contrast Didone glyph drawn with an
 * SVG <text> in Bodoni, so it carries the same thick/thin contrast as the
 * wordmark and scales exactly with its box (via viewBox, like the old mark).
 * currentColor — inherits ink/bone.
 */
export function SMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("block font-serif", className)}
      aria-hidden="true"
    >
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontFamily="inherit"
        fontWeight={600}
        fontSize="42"
      >
        S
      </text>
    </svg>
  );
}

export function Brandmark({
  className,
  markClassName,
  wordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-full bg-bone text-ink",
          markClassName ?? "size-9",
        )}
      >
        <SMark className="size-[64%]" />
      </span>
      {wordmark && (
        <span className="font-display text-bone tracking-mega text-[1.35rem] font-black leading-none">
          SOLANGE
        </span>
      )}
    </span>
  );
}
