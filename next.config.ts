import type { NextConfig } from "next";

// Conservative baseline CSP. Inline scripts are required: JSON-LD
// (<script type="application/ld+json">) and Next.js's bootstrap/runtime
// inline chunks both need 'unsafe-inline' under this app's setup, so it is
// intentionally included. Inline styles ('unsafe-inline') cover Tailwind/Next
// style injection. Images allow data: and blob: for grain/Photo fallbacks.
//
// 'unsafe-eval' is added ONLY in development: Next's dev client runtime
// (React Refresh / Turbopack HMR) evaluates modules via eval(), and strict
// browsers — notably iOS Safari — enforce the CSP hard enough to kill the
// whole client bundle without it (blank/black screen when testing dev on a
// phone). Production stays strict: no 'unsafe-eval'.
//
// connect-src is also dev-only-relaxed for WebSockets. Without an explicit
// connect-src the CSP falls back to default-src 'self', and Safari (unlike
// Chrome) does NOT allow ws:// under 'self' — so the Fast Refresh HMR socket
// (ws://<lan-ip>:3000/_next/webpack-hmr) is blocked, breaking live reload when
// testing dev on a phone/desktop Safari. Allowing ws:/wss: in dev fixes it.
// Production has no HMR socket and no external calls, so it stays 'self'.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const connectSrc = isDev
  ? "connect-src 'self' ws: wss:"
  : "connect-src 'self'";
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  connectSrc,
  "font-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in the home dir otherwise
  // makes Turbopack infer the wrong root.
  turbopack: { root: __dirname },

  // next/image ready for locally-served assets in /public. No remotePatterns
  // needed since all images are same-origin.
  images: {
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
