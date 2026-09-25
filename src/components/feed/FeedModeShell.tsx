"use client";

import { useState } from "react";
import { FeedTopBar } from "./FeedTopBar";
import { VideoFeed } from "./VideoFeed";
import { ShopFeed } from "./ShopFeed";

export type FeedMode = "scroll" | "shop";

/**
 * Home experience shell. Holds the top-level mode and renders the shared top
 * bar (logo + the interactive Scroll/Boutique switch) over whichever feed is
 * active: the TikTok/Instagram video scroll, or the Vinted-style shop feed.
 */
export function FeedModeShell() {
  const [mode, setMode] = useState<FeedMode>("scroll");

  return (
    <>
      {/* titre de l'accueil pour le rotor ; suit le fil affiché */}
      <h1 className="sr-only">{mode === "scroll" ? "Looks" : "Pièces"}</h1>
      <FeedTopBar mode={mode} onModeChange={setMode} />
      {mode === "scroll" ? <VideoFeed /> : <ShopFeed />}
    </>
  );
}
