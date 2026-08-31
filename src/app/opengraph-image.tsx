import { ImageResponse } from "next/og";

export const alt = "SOLANGE — La mode circulaire & connectée";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Strict noir & blanc. No chroma. System heavy sans (ImageResponse can't easily
// load next/font, so we lean on the runtime's bold system stack).
const NOIR = "#0b0b0c";
const BONE = "#f3f0e8";
const ASH = "#8a8782";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: NOIR,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif",
      }}
    >
      {/* hairline frame for an editorial, print-like crop */}
      <div
        style={{
          position: "absolute",
          inset: 44,
          border: `1px solid ${BONE}`,
          opacity: 0.16,
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: 220,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          color: BONE,
          lineHeight: 1,
        }}
      >
        SOLANGE
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: ASH,
        }}
      >
        La mode circulaire &amp; connectée
      </div>
    </div>,
    { ...size },
  );
}
