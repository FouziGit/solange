"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The immersive video feed ("/") is a white-on-video experience that must stay
 * dark in every OS theme — otherwise its `text-bone` overlays invert to
 * dark-on-video and become unreadable in light mode. This toggles the
 * `.theme-dark` force-dark scope on <html> for the feed route only; every other
 * route follows the OS light/dark preference. The feed page also carries
 * `.theme-dark` on its own wrapper so its content never flashes light on load.
 */
export function FeedThemeLock() {
  const pathname = usePathname();

  useEffect(() => {
    const isFeed = pathname === "/";
    document.documentElement.classList.toggle("theme-dark", isFeed);
    return () => document.documentElement.classList.remove("theme-dark");
  }, [pathname]);

  return null;
}
