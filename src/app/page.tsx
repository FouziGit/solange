import type { Metadata } from "next";
import { VideoFeed } from "@/components/feed/VideoFeed";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "Le feed SOLANGE : des looks vidéo en plein écran, chaque pièce shoppable. Inspire-toi, achète, revends.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Feed",
    description:
      "Le feed SOLANGE : des looks vidéo en plein écran, chaque pièce shoppable.",
    url: "/",
  },
};

export default function Home() {
  return (
    <div id="top" className="relative">
      {/* desktop editorial flourish in the letterbox voids */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 hidden select-none md:block"
      >
        <span className="absolute left-[5rem] top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap font-editorial text-[7.5rem] font-medium italic leading-none tracking-tight text-bone/[0.05]">
          Seconde Main
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap font-editorial text-[7.5rem] font-medium italic leading-none tracking-tight text-bone/[0.05]">
          Circular
        </span>
        <span className="eyebrow absolute bottom-8 left-[7rem] text-sm text-bone/20">
          édition Nº1 · Paris
        </span>
      </div>

      <VideoFeed />
    </div>
  );
}
