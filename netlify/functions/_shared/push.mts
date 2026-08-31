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
  normalizePrefs,
  type PushPrefs,
  type PushType,
  type StoredPrefs,
} from "../../../src/lib/push-rules.ts";

export type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  ua?: string;
  createdAt: number;
  lastOkAt?: number;
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

/** Heure locale à Paris — les heures calmes sont dites en heure de chez nous. */
function parisHour(at: number): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(at)),
  );
}

/** Compteur horaire glissant (plafond anti-spam). */
async function hourlyCount(userId: string, now: number): Promise<number> {
  const rec = (await store("push").get(`q:${userId}`, { type: "json" })) as {
    hour: number;
    count: number;
  } | null;
  const hour = Math.floor(now / 3_600_000);
  return rec?.hour === hour ? rec.count : 0;
}

async function bumpHourly(userId: string, now: number) {
  const push = store("push");
  const hour = Math.floor(now / 3_600_000);
  const rec = (await push.get(`q:${userId}`, { type: "json" })) as {
    hour: number;
    count: number;
  } | null;
  await push.setJSON(`q:${userId}`, {
    hour,
    count: rec?.hour === hour ? rec.count + 1 : 1,
  });
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
    const decision = decidePush(prefs, notif.type, {
      hour: parisHour(now),
      sentThisHour: await hourlyCount(userId, now),
    });
    // Refusé : l'événement reste dans la cloche (déjà écrit) — rien de perdu.
    if (!decision.send) return;

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

    let delivered = false;
    for (const sub of subs) {
      try {
        const encrypted = await encryptPayload(sub, payload);
        const res = await fetch(sub.endpoint, {
          method: "POST",
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
        if (res.status === 404 || res.status === 410) {
          await dropSubscription(userId, sub.endpoint);
          continue;
        }
        if (res.ok) delivered = true;
      } catch {
        // appareil injoignable : on tente les autres
      }
    }
    if (delivered) await bumpHourly(userId, now);
  } catch {
    console.error("push_send_error");
  }
}
