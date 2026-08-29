/* POST /api/social — persiste likes / gardés / abonnements / communautés.
   {kind: 'liked'|'saved'|'follows'|'joined', id: string, on: boolean} */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  currentUser,
  sameOrigin,
  readJson,
} from "./_shared/core.mts";

const KINDS = new Set(["liked", "saved", "follows", "joined"]);

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);

  const b = await readJson<{ kind?: string; id?: string; on?: boolean }>(req);
  const kind = b?.kind ?? "";
  const id = (b?.id ?? "").slice(0, 80);
  if (!KINDS.has(kind) || !id) return bad("Requête invalide");

  const social = store("social");
  const state =
    ((await social.get(`s:${user.id}`, { type: "json" })) as Record<
      string,
      string[]
    >) ?? {};
  const set = new Set(state[kind] ?? []);
  if (b?.on) set.add(id);
  else set.delete(id);
  if (set.size > 2000) return bad("Limite atteinte", 429); // anti-spam simple
  state[kind] = [...set];
  await social.setJSON(`s:${user.id}`, state);
  return json({ ok: true });
};

export const config: Config = { path: "/api/social" };
