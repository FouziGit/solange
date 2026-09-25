"use client";

import { useSyncExternalStore } from "react";
import {
  NO_ANNOUNCEMENT,
  getAnnouncements,
  subscribeAnnouncements,
} from "@/lib/announce";

/**
 * Les deux régions live de l'app, montées UNE fois dans layout.tsx, hors
 * de AuthGate (l'écran d'inscription s'en sert aussi). Elles existent
 * vides dès le premier rendu ; seul leur texte change, via announce()
 * de src/lib/announce.ts. Ne pas en monter d'autre copie.
 */
export function LiveAnnouncer() {
  const { polite, assertive } = useSyncExternalStore(
    subscribeAnnouncements,
    getAnnouncements,
    () => NO_ANNOUNCEMENT,
  );
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {polite}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertive}
      </div>
    </>
  );
}
