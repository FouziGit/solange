/* POST /api/auth/logout — révoque le cookie de session. */
import type { Config } from "@netlify/functions";
import { json, bad, clearSessionCookie, sameOrigin } from "./_shared/core.mts";

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};

export const config: Config = { path: "/api/auth/logout" };
