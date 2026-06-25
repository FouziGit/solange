import type { NextConfig } from "next";

// Conservative baseline CSP. Inline scripts are required: JSON-LD
// (<script type="application/ld+json">) and Next.js's bootstrap/runtime
// inline chunks both need 'unsafe-inline' under this app's setup, so it is
// intentionally included. Inline styles ('unsafe-inline') cover Tailwind/Next
// style injection. Images allow data: and blob: for grain/Photo fallbacks.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
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
