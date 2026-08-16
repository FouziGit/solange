"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { LogoMark } from "./Brandmark";

export const ONBOARD_KEY = "solange:onboarded";

/**
 * Gates the whole app behind the onboarding screen. Persists the unlocked
 * state in localStorage so it only shows once. A brief branded splash covers
 * the first client tick so the app never flashes before we know the state.
 * To see it again: clear site data, or use the "Déconnexion" action.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  // One-time, hydration-safe read of the persisted onboarding flag (localStorage
  // is client-only, so we resolve it after mount rather than during SSR).
  const [state, setState] = useState({ ready: false, authed: false });
  const { ready, authed } = state;

  useEffect(() => {
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARD_KEY) === "1";
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
        <span className="pulse-ring rounded-full">
          <LogoMark variant="white" className="size-16" />
        </span>
      </div>
    );
  }

  if (!authed) return <AuthScreen onComplete={complete} />;

  return <>{children}</>;
}
