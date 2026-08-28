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

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const bad = (message: string, status = 400) => json({ error: message }, status);

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

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
