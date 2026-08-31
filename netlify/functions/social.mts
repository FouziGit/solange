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
  pushNotif,
} from "./_shared/core.mts";

const KINDS = new Set(["liked", "saved", "follows", "joined", "blocked"]);

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

  // Compteur global de likes (map unique — approximation assumée en beta).
  if (kind === "liked") {
    const counters = store("counters");
    const map =
      ((await counters.get("likes", { type: "json" })) as Record<
        string,
        number
      >) ?? {};
    map[id] = Math.max(0, (map[id] ?? 0) + (b?.on ? 1 : -1));
    await counters.setJSON("likes", map);

    // Lot 3 : le j'aime sur une ANNONCE MEMBRE prévient son vendeur (le
    // catalogue seed n'a pas de propriétaire réel à prévenir).
    if (b?.on) {
      const p = (await store("products").get(`p:${id}`, {
        type: "json",
      })) as { sellerId?: string; brand?: string; name?: string } | null;
      if (p?.sellerId && p.sellerId !== user.id)
        await pushNotif(p.sellerId, {
          type: "like",
          text: `@${user.handle} a aimé ${p.brand} ${p.name}`,
          link: "/profil",
        });
    }
  }

  // Follow d'un membre réel → notification cloche.
  if (kind === "follows" && b?.on) {
    const targetId = (await store("users").get(`handle:${id}`, {
      type: "text",
    })) as string | null;
    if (targetId && targetId !== user.id)
      await pushNotif(targetId, {
        type: "follow",
        text: `@${user.handle} te suit désormais`,
        link: `/membre/${user.handle}`,
      });
  }

  return json({ ok: true });
};

export const config: Config = { path: "/api/social" };
