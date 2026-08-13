import { cn } from "@/lib/utils";

/**
 * The real SOLANGE brandmark — the "S" swirl (512px, square). Rendered as a CSS
 * mask filled with a colour token so it follows the light/dark theme
 * automatically: `variant="auto"` (default) paints it with `bone`, which is
 * white on dark surfaces and near-black on light ones. `variant="white"` /
 * `"black"` force a fixed colour (e.g. always-white over the dark video feed).
 * Size via className — use a SQUARE size (e.g. `size-8`); the mark is square.
 */
export function LogoMark({
  variant = "auto",
  className,
}: {
  variant?: "auto" | "white" | "black";
  className?: string;
}) {
  const fill =
    variant === "white"
      ? "bg-white"
      : variant === "black"
        ? "bg-black"
        : "bg-bone";
  return (
    <span
      role="img"
      aria-label="SOLANGE"
      className={cn("block select-none", fill, className)}
      style={{
        WebkitMaskImage: "url(/branding/logo-black.png)",
        maskImage: "url(/branding/logo-black.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
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
