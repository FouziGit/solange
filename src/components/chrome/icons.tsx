/* Minimal line-icon set — 24×24, currentColor stroke. No icon dependency. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Home = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 10.2 12 3l9 7.2" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const Compass = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);

export const Plus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Chat = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 11.5a8 8 0 0 1-11.6 7.1L3 21l2.4-6.4A8 8 0 1 1 21 11.5Z" />
  </svg>
);

export const User = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const Heart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M12 20.5 4.2 12.7a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 1 1 6.5 6.5z" />
  </svg>
);

export const Comment = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.5A8 8 0 1 1 20 12Z" />
  </svg>
);

export const Share = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.5 18-4-8-8-4z" />
  </svg>
);

export const Bookmark = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
  </svg>
);

export const Search = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const Verified = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="m12 1.8 2.3 1.9 3 .1.9 2.8 2.4 1.7-.8 2.9 1 2.8-2 2.2.1 3-2.8 1-1.5 2.6h-3l-2.5 1.7-2.5-1.7h-3L6 18.9l-2.8-1 .1-3-2-2.2 1-2.8-.8-2.9L4 5.5l.9-2.8 3-.1z" />
    <path
      d="m8.5 12 2.4 2.4 4.6-4.8"
      fill="none"
      stroke="#060607"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Bag = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 8h12l-1 12.5a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);

export const Pin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const Music = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

export const Mute = (p: P) => (
  <svg {...base} {...p}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m17 9 4 6M21 9l-4 6" />
  </svg>
);

export const Volume = (p: P) => (
  <svg {...base} {...p}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const Play = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 4.5 19 12 7 19.5z" />
  </svg>
);

export const ChevronUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);

export const X = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Sparkle = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7Z" />
  </svg>
);

export const Sliders = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="13" cy="18" r="2" />
  </svg>
);

export const Star = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 17l-5.3 2.6 1-5.8-4.2-4.1 5.9-.9z" />
  </svg>
);

export const Grid = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </svg>
);

export const Camera = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const ArrowLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const ChevronRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const Crown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 18h16M4 18l-1.5-9 5 3.5L12 5l4.5 7.5 5-3.5L20 18" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 12.5 4.5 4.5L19 6" />
  </svg>
);

export const Send = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.5 18-4-8-8-4z" />
  </svg>
);

export const Bell = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 1.5 6.5 2.5 7.5H3.5C4.5 15.5 6 14 6 9Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const Live = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const Users = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
  </svg>
);
