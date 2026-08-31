"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { LEGAL_DOCS } from "@/lib/legal";
import { AuthScreen } from "./AuthScreen";
import { LegalGate } from "./LegalGate";
import { LogoMark } from "./Brandmark";

/* Les documents légaux restent atteignables SANS compte : l'article 6-III
   de la LCEN demande un accès « facile, direct et permanent », et l'écran
   d'inscription y renvoie avant de faire cocher quoi que ce soit. Sans
   cette dérogation, les liens de la case d'acceptation ne mèneraient
   nulle part. */
const LEGAL_PATHS = new Set<string>([
  "/informations-legales",
  ...LEGAL_DOCS.map((d) => d.href),
]);

export const ONBOARD_KEY = "solange:onboarded";

/**
 * Gates the whole app behind the onboarding screen. Une vraie session
 * serveur (cookie httpOnly, vérifiée par /api/me via le store) déverrouille
 * directement ; sinon le flag localStorage garde le comportement « démo vue
 * une fois ». A brief branded splash covers the first client tick.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useStore();
  const pathname = usePathname();
  // One-time, hydration-safe read of the persisted onboarding flag (localStorage
  // is client-only, so we resolve it after mount rather than during SSR).
  const [state, setState] = useState({ ready: false, authed: false });
  const ready = state.ready && authReady;
  const authed = state.authed || user !== null;

  useEffect(() => {
    let onboarded = false;
    try {
      // outillage (Lighthouse/captures) : ?e2e=1 == « Passer » (mode invité)
      if (new URLSearchParams(location.search).get("e2e") === "1")
        onboarded = true;
      onboarded = onboarded || localStorage.getItem(ONBOARD_KEY) === "1";
    } catch {
      /* storage blocked — treat as not onboarded */
    }
    // eslint-disable-next-line -- one-shot external-state read on mount
    setState({ ready: true, authed: onboarded });
  }, []);

  const complete = () => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, authed: true }));
  };

  if (!ready) {
    return (
      <div className="theme-dark fixed inset-0 z-[100] grid place-items-center bg-noir">
        <span className="relative grid place-items-center">
          {/* anneau séparé animé en transform/opacity (composité GPU) : un
              box-shadow animé repeindrait toute la zone à chaque frame et
              fait trembler le splash sur mobile (jank à l'ouverture PWA) */}
          <span
            aria-hidden
            className="pulse-ring absolute -inset-3 rounded-full border border-bone/40"
          />
          <LogoMark variant="white" className="size-16" />
        </span>
      </div>
    );
  }

  if (!authed && !LEGAL_PATHS.has(pathname))
    return <AuthScreen onComplete={complete} />;

  return <LegalGate>{children}</LegalGate>;
}
