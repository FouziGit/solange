/* ============================================================
   SOLANGE backend — socle partagé des Netlify Functions.
   Stockage : Netlify Blobs (consistance forte). Session : JWT
   HS256 (jose) en cookie httpOnly. Zéro donnée sensible loggée.
   ============================================================ */
import { getStore } from "@netlify/blobs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomInt, randomUUID } from "node:crypto";

export type SessionUser = {
  id: string;
  email: string;
  handle: string;
  name: string;
};

export const store = (name: string) =>
  getStore({ name, consistency: "strong" });

export const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const bad = (message: string, status = 400) =>
  json({ error: message }, status);

export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");

export const newId = (prefix: string) =>
  `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const otpCode = () => String(randomInt(100000, 1000000)); // RNG crypto, 6 chiffres

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET manquant");
  return new TextEncoder().encode(s);
};

const COOKIE = "sol_s";

export async function makeSessionCookie(userId: string): Promise<string> {
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  return `${COOKIE}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`;
}

export const clearSessionCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function sessionUserId(req: Request): Promise<string | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], secret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function currentUser(req: Request): Promise<SessionUser | null> {
  const id = await sessionUserId(req);
  if (!id) return null;
  const u = await store("users").get(`u:${id}`, { type: "json" });
  return (u as SessionUser) ?? null;
}

/** Garde CSRF minimale : les mutations doivent venir de notre propre origine. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // requêtes non-CORS (curl, native)
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const APP_URL =
  process.env.APP_URL ?? "https://solange-beta.netlify.app";

/** Email transactionnel via Resend. Silent-fail : une notification qui
    échoue ne doit JAMAIS faire échouer la commande/le message. */
export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<void> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "SOLANGE <solange@nouhbenzidane.fr>",
        to: [to],
        subject,
        html: `<div style="background:#0d0d0e;color:#f4f1ea;font-family:Helvetica,Arial,sans-serif;padding:40px 24px">
          <p style="letter-spacing:.35em;font-size:12px;margin:0 0 28px;text-align:center">S O L A N G E</p>
          ${bodyHtml}
          <p style="font-size:11px;color:#8a857b;margin:28px 0 0;text-align:center">Beta · démonstration — paiements simulés</p>
        </div>`,
      }),
    });
    if (!res.ok) console.error("notify_email_error", res.status);
  } catch {
    console.error("notify_email_unreachable");
  }
}

/** Email d'un membre par id (null si introuvable). */
export async function userEmail(userId: string): Promise<string | null> {
  const u = (await store("users").get(`u:${userId}`, { type: "json" })) as {
    email?: string;
  } | null;
  return u?.email ?? null;
}

/** Plafond glissant simple : max `max` actions par fenêtre. true = autorisé. */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const rates = store("rates");
  const now = Date.now();
  const rec = (await rates.get(key, { type: "json" })) as {
    n: number;
    resetAt: number;
  } | null;
  if (!rec || now > rec.resetAt) {
    await rates.setJSON(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.n >= max) return false;
  await rates.setJSON(key, { ...rec, n: rec.n + 1 });
  return true;
}

/** Notification in-app (cloche). Silent-fail. */
export async function pushNotif(
  userId: string,
  notif: {
    type: "sale" | "message" | "follow" | "report" | "order";
    text: string;
    link: string;
  },
): Promise<void> {
  try {
    const notifs = store("notifs");
    const list =
      ((await notifs.get(`n:${userId}`, { type: "json" })) as unknown[]) ?? [];
    list.push({ id: newId("nt"), ...notif, at: Date.now(), read: false });
    await notifs.setJSON(`n:${userId}`, list.slice(-50));
  } catch {
    console.error("notif_push_error");
  }
}
