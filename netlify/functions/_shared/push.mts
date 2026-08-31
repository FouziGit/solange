/* Envoi des notifications push (lot 3) — branché DANS `pushNotif` de
   core.mts : tout événement déjà écrit par les lots précédents (vente,
   commande, message, Cercle, abonné, j'aime) part aussi en push, sans une
   ligne dupliquée. Silencieux par construction : sans clés VAPID, rien ne
   part et rien ne casse (le lot est livré éteint). */
import { store } from "./core.mts";
import { encryptPayload, vapidHeader } from "../../../src/lib/webpush.ts";
import {
  GROUP_WINDOW_MS,
  decidePush,
  groupedText,
  isAllowedPushEndpoint,
  normalizePrefs,
  parisHour,
  type PushPrefs,
  type PushType,
  type StoredPrefs,
} from "../../../src/lib/push-rules.ts";

/* Minimisation : strictement ce qu'il faut pour envoyer. Pas d'empreinte
   d'appareil (le user-agent stocké au départ n'était jamais lu). */
export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: number;
};

function vapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ?? "mailto:contact@nouhbenzidane.fr";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Le lot est-il actif ? (drapeau = présence des clés) */
export function pushEnabled(): boolean {
  return vapidKeys() !== null;
}

export async function getPrefs(userId: string): Promise<PushPrefs> {
  const raw = (await store("push").get(`p:${userId}`, {
    type: "json",
  })) as StoredPrefs | null;
  return normalizePrefs(raw);
}

export async function getSubscriptions(
  userId: string,
): Promise<StoredSubscription[]> {
  return (
    ((await store("push").get(`s:${userId}`, {
      type: "json",
    })) as StoredSubscription[]) ?? []
  );
}

/* Plafond : fenêtre GLISSANTE d'une heure, pas un seau d'heure ronde.
   Un seau (« heure UTC courante ») laisserait passer 8 push à 10 h 59 puis
   8 autres à 11 h 01 — 16 en deux minutes, alors que la promesse est 8 par
   heure. On garde donc les horodatages des envois, élagués à chaque
   lecture. */
async function recentSends(userId: string, now: number): Promise<number[]> {
  const rec = (await store("push").get(`q:${userId}`, {
    type: "json",
  })) as number[] | { hour: number; count: number } | null;
  // tolère l'ancien format (seau) : on repart d'une fenêtre vide
  if (!Array.isArray(rec)) return [];
  return rec.filter((t) => now - t < 3_600_000);
}

async function recordSend(userId: string, now: number, recent: number[]) {
  await store("push").setJSON(`q:${userId}`, [...recent, now].slice(-50));
}

/** Regroupement : combien d'événements de ce type dans la fenêtre ? */
async function groupCount(
  userId: string,
  type: PushType,
  now: number,
): Promise<number> {
  const push = store("push");
  const key = `g:${userId}:${type}`;
  const rec = (await push.get(key, { type: "json" })) as {
    count: number;
    firstAt: number;
  } | null;
  const fresh = rec && now - rec.firstAt < GROUP_WINDOW_MS;
  const next = fresh
    ? { count: rec.count + 1, firstAt: rec.firstAt }
    : { count: 1, firstAt: now };
  await push.setJSON(key, next);
  return next.count;
}

/** Retire un abonnement mort (410/404) — pas d'endpoints fantômes. */
async function dropSubscription(userId: string, endpoint: string) {
  const push = store("push");
  const subs = await getSubscriptions(userId);
  await push.setJSON(
    `s:${userId}`,
    subs.filter((s) => s.endpoint !== endpoint),
  );
}

/**
 * Envoie un push si les préférences, les heures calmes et le plafond le
 * permettent. Ne jette jamais : un push raté ne doit pas faire échouer la
 * vente, le message ou la réponse qui l'a déclenché.
 */
export async function sendPush(
  userId: string,
  notif: { type: PushType; text: string; link: string },
): Promise<void> {
  try {
    const keys = vapidKeys();
    if (!keys) return; // lot éteint : aucune clé posée

    const subs = await getSubscriptions(userId);
    if (subs.length === 0) return;

    const now = Date.now();
    const prefs = await getPrefs(userId);
    const recent = await recentSends(userId, now);
    const decision = decidePush(prefs, notif.type, {
      hour: parisHour(now),
      sentThisHour: recent.length,
    });
    // Refusé : l'événement reste dans la cloche (déjà écrit) — rien de perdu.
    if (!decision.send) return;

    /* On compte la TENTATIVE, pas le succès. Compter les succès rendait le
       plafond inatteignable en faisant échouer les envois exprès : le
       serveur devenait un amplificateur (1 requête → N POST sortants).
       Le prix : une salve d'échecs consomme le quota — acceptable, la
       cloche garde tout. */
    await recordSend(userId, now, recent);

    const count = await groupCount(userId, notif.type, now);
    const body = count > 1 ? groupedText(notif.type, count) : notif.text;

    const payload = JSON.stringify({
      title: "SOLANGE",
      body,
      // même tag → le système REMPLACE la notification au lieu d'empiler
      tag: notif.type,
      link: count > 1 ? "/notifications" : notif.link,
      count,
    });

    for (const sub of subs) {
      // Deuxième garde : un endpoint enregistré AVANT la liste blanche (ou
      // par une version antérieure) ne doit pas être appelé pour autant.
      if (!isAllowedPushEndpoint(sub.endpoint)) {
        await dropSubscription(userId, sub.endpoint);
        continue;
      }
      try {
        const encrypted = await encryptPayload(sub, payload);
        const res = await fetch(sub.endpoint, {
          method: "POST",
          // pas de redirection suivie : un 307 rejouerait le corps chiffré
          // vers un hôte hors liste blanche
          redirect: "manual",
          headers: {
            Authorization: await vapidHeader(
              sub.endpoint,
              keys,
              Math.floor(now / 1000),
            ),
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
            Urgency: "normal",
          },
          body: encrypted as unknown as BodyInit,
        });
        // l'appareil a désinstallé l'app ou révoqué l'abonnement
        if (res.status === 404 || res.status === 410)
          await dropSubscription(userId, sub.endpoint);
      } catch {
        // appareil injoignable : on tente les autres
      }
    }
  } catch {
    console.error("push_send_error");
  }
}
