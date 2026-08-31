/* /api/push (lot 3)
   GET                        → { enabled, publicKey, subscribed, prefs }
   POST {op:"subscribe", subscription}   → enregistre CET appareil
   POST {op:"unsubscribe", endpoint?}    → retire cet appareil (ou tous)
   POST {op:"prefs", prefs}              → règle les préférences
   POST {op:"test"}                      → s'envoie un push (vérification)

   Un abonnement est lié au compte et n'est JAMAIS exposé à un tiers : la
   lecture ne renvoie que l'état de MON appareil. */
import type { Config } from "@netlify/functions";
import {
  bad,
  currentUser,
  json,
  readJson,
  sameOrigin,
  store,
} from "./_shared/core.mts";
import {
  getPrefs,
  getSubscriptions,
  pushEnabled,
  sendPush,
  type StoredSubscription,
} from "./_shared/push.mts";
import {
  normalizePrefs,
  PUSH_TYPES,
  type PushPrefs,
  type StoredPrefs,
} from "../../src/lib/push-rules.ts";

const MAX_DEVICES = 10;

export default async (req: Request) => {
  const user = await currentUser(req);
  const enabled = pushEnabled();
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? null;

  if (req.method === "GET") {
    if (!user) return json({ enabled, publicKey, subscribed: false });
    const subs = await getSubscriptions(user.id);
    return json({
      enabled,
      publicKey,
      // on ne renvoie QUE le nombre : jamais les endpoints eux-mêmes
      subscribed: subs.length > 0,
      devices: subs.length,
      prefs: await getPrefs(user.id),
    });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi", 401);

  const b = await readJson<{
    op?: string;
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    endpoint?: string;
    prefs?: StoredPrefs;
  }>(req);
  const push = store("push");

  if (b?.op === "subscribe") {
    if (!enabled) return bad("Notifications push non configurées", 503);
    const s = b.subscription;
    const endpoint = (s?.endpoint ?? "").trim();
    const p256dh = (s?.keys?.p256dh ?? "").trim();
    const auth = (s?.keys?.auth ?? "").trim();
    if (!endpoint.startsWith("https://") || !p256dh || !auth)
      return bad("Abonnement invalide");

    const subs = await getSubscriptions(user.id);
    // idempotent : le même appareil se ré-enregistre sans se dupliquer
    const rest = subs.filter((x) => x.endpoint !== endpoint);
    const next: StoredSubscription[] = [
      ...rest.slice(-(MAX_DEVICES - 1)),
      {
        endpoint,
        p256dh,
        auth,
        ua: req.headers.get("user-agent")?.slice(0, 120) ?? undefined,
        createdAt: Date.now(),
      },
    ];
    await push.setJSON(`s:${user.id}`, next);
    return json({ ok: true, devices: next.length });
  }

  if (b?.op === "unsubscribe") {
    const subs = await getSubscriptions(user.id);
    const next = b.endpoint
      ? subs.filter((x) => x.endpoint !== b.endpoint)
      : [];
    await push.setJSON(`s:${user.id}`, next);
    return json({ ok: true, devices: next.length });
  }

  if (b?.op === "prefs") {
    const incoming = b.prefs ?? {};
    // on ne fait confiance à rien : bornes et types revalidés ici
    const types: Record<string, boolean> = {};
    for (const t of PUSH_TYPES) types[t] = incoming.types?.[t] !== false;
    const clamp = (n: unknown, dflt: number) =>
      typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 23
        ? n
        : dflt;
    const prefs = normalizePrefs({
      enabled: incoming.enabled !== false,
      types: types as PushPrefs["types"],
      quietFrom: clamp(incoming.quietFrom, 22),
      quietTo: clamp(incoming.quietTo, 8),
    });
    await push.setJSON(`p:${user.id}`, prefs);
    return json({ ok: true, prefs });
  }

  if (b?.op === "test") {
    if (!enabled) return bad("Notifications push non configurées", 503);
    const subs = await getSubscriptions(user.id);
    if (subs.length === 0) return bad("Aucun appareil abonné", 409);
    await sendPush(user.id, {
      type: "order",
      text: "Les notifications sont actives.",
      link: "/profil",
    });
    return json({ ok: true });
  }

  return bad("Opération inconnue", 400);
};

export const config: Config = { path: "/api/push" };
