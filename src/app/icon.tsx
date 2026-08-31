import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Monochrome mark: bone "S" on noir. No chroma.
const NOIR = "#0b0b0c";
const BONE = "#f3f0e8";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: NOIR,
        color: BONE,
        fontSize: 360,
        fontWeight: 900,
        letterSpacing: "-0.04em",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif",
      }}
    >
      S
    </div>,
    { ...size },
  );
}
