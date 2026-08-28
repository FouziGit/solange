/* POST /api/auth/verify — vérifie l'OTP, crée le compte au premier login,
   pose le cookie de session httpOnly. Max 5 essais par code. */
import type { Config } from "@netlify/functions";
import {
  store, json, bad, sha256, newId, makeSessionCookie, sameOrigin, readJson,
  type SessionUser,
} from "./_shared/core.mts";

function handleFrom(email: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "membre";
  return base;
}

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);

  const body = await readJson<{ email?: string; code?: string }>(req);
  const email = body?.email?.trim().toLowerCase() ?? "";
  const code = (body?.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return bad("Code invalide");

  const otps = store("otps");
  const key = sha256(email);
  const rec = (await otps.get(key, { type: "json" })) as
    | { h: string; exp: number; tries: number; sentAt: number }
    | null;

  if (!rec || Date.now() > rec.exp) return bad("Code expiré — redemande un code", 410);
  if (rec.tries >= 5) return bad("Trop d'essais — redemande un code", 429);

  if (sha256(code + key) !== rec.h) {
    await otps.setJSON(key, { ...rec, tries: rec.tries + 1 });
    return bad("Code incorrect", 401);
  }
  await otps.delete(key);

  const users = store("users");
  let userId = (await users.get(`email:${key}`, { type: "text" })) as string | null;

  if (!userId) {
    userId = newId("u");
    const base = handleFrom(email);
    let handle = base;
    for (let i = 0; await users.get(`handle:${handle}`, { type: "text" }); i++) {
      handle = `${base}${Math.floor(100 + Math.random() * 900)}`;
      if (i > 5) break;
    }
    const user: SessionUser = {
      id: userId,
      email,
      handle,
      name: base.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
    await users.setJSON(`u:${userId}`, user);
    await users.set(`email:${key}`, userId);
    await users.set(`handle:${handle}`, userId);
  }

  const user = (await users.get(`u:${userId}`, { type: "json" })) as SessionUser;
  return json(
    { ok: true, user: { id: user.id, handle: user.handle, name: user.name, email: user.email } },
    200,
    { "set-cookie": await makeSessionCookie(userId) },
  );
};

export const config: Config = { path: "/api/auth/verify" };
