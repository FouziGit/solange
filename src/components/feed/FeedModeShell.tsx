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
      <FeedTopBar mode={mode} onModeChange={setMode} />
      {mode === "scroll" ? <VideoFeed /> : <ShopFeed />}
    </>
  );
}
