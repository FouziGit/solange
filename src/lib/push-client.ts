/* ============================================================
   SOLANGE — côté navigateur des notifications push (lot 3).
   Enregistrement du service worker, abonnement, et surtout : le MOMENT
   de la demande. Jamais au premier lancement — seulement après une
   première action qui compte, et une seule fois.
   ============================================================ */

import { api } from "./api";
import { b64uToBytes } from "./webpush";

const ASKED_KEY = "solange:push-asked"; // horodatage du dernier refus
const ACTED_KEY = "solange:push-acted"; // une action qui compte a eu lieu
const ASK_AGAIN_MS = 30 * 24 * 3600_000; // on ne réinsiste pas avant un mois

export type PushSupport =
  | { kind: "ready" } // on peut demander
  | { kind: "granted" } // déjà accordé
  | { kind: "denied" } // refusé au niveau du navigateur : ne rien proposer
  | { kind: "ios-install" } // iOS : installer sur l'écran d'accueil d'abord
  | { kind: "unsupported" };

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS se présente comme un Mac tactile
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Ce que cet appareil sait faire, ici et maintenant. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { kind: "unsupported" };
  const hasApi =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  // iOS n'expose le push QUE dans une app installée sur l'écran d'accueil.
  // Sauf dans un navigateur intégré (Instagram, TikTok…) : là, même
  // installée, l'app n'aurait pas les API — inutile d'envoyer la personne
  // installer quoi que ce soit.
  if (isIOS() && !isStandalone())
    return hasApi ? { kind: "ios-install" } : { kind: "unsupported" };
  if (!hasApi) return { kind: "unsupported" };
  if (Notification.permission === "granted") return { kind: "granted" };
  if (Notification.permission === "denied") return { kind: "denied" };
  return { kind: "ready" };
}

/** Marque qu'une action qui compte vient d'avoir lieu (like, vente, cercle). */
export function markMeaningfulAction(): void {
  try {
    localStorage.setItem(ACTED_KEY, "1");
  } catch {
    /* stockage indisponible — l'invitation attendra la prochaine session */
  }
}

/** Faut-il proposer l'invitation maintenant ? (jamais au premier lancement) */
export function shouldInvite(): boolean {
  try {
    if (localStorage.getItem(ACTED_KEY) !== "1") return false;
    const asked = Number(localStorage.getItem(ASKED_KEY) ?? 0);
    return Date.now() - asked > ASK_AGAIN_MS;
  } catch {
    return false;
  }
}

/** « Plus tard » : on note, et on ne réinsiste pas avant un mois. */
export function snoozeInvite(): void {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function register(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export type SubscribeResult =
  { ok: true } | { ok: false; error: string; denied?: boolean };

/**
 * Demande la permission native PUIS abonne l'appareil. À n'appeler
 * qu'après un « oui » explicite dans l'invitation in-app.
 */
export async function subscribeDevice(): Promise<SubscribeResult> {
  const conf = await api.pushConfig();
  if (!conf.ok) return { ok: false, error: conf.error };
  if (!conf.data.enabled || !conf.data.publicKey)
    return {
      ok: false,
      error: "Notifications pas encore activées côté serveur",
    };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    snoozeInvite();
    return {
      ok: false,
      error: "Notifications refusées",
      denied: permission === "denied",
    };
  }

  const reg = await register();
  if (!reg) return { ok: false, error: "Service worker indisponible" };
  await navigator.serviceWorker.ready;

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64uToBytes(
        conf.data.publicKey,
      ) as unknown as BufferSource,
    });
    const res = await api.pushSubscribe(sub.toJSON());
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch {
    return { ok: false, error: "Abonnement refusé par le navigateur" };
  }
}

/** Coupe les notifications sur CET appareil (et côté serveur). */
export async function unsubscribeDevice(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint);
      await sub.unsubscribe();
    } else {
      await api.pushUnsubscribe();
    }
  } catch {
    /* le serveur reste maître : les préférences suffisent à tout couper */
  }
}
