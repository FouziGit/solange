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
  rateLimit,
  assertCanWrite,
} from "./_shared/core.mts";

const KINDS = new Set(["liked", "saved", "follows", "joined", "blocked"]);

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;

  const b = await readJson<{ kind?: string; id?: string; on?: boolean }>(req);
  const kind = b?.kind ?? "";
  const id = (b?.id ?? "").slice(0, 80);
  if (!KINDS.has(kind) || !id) return bad("Requête invalide");

  /* Ces écritures notifient des tiers (j'aime sur une annonce, nouvel
     abonné). Sans plafond, une boucle suivre / ne plus suivre remplit la
     cloche de quelqu'un d'autre jusqu'à la rendre inutilisable. Le seuil
     est large : il gêne la boucle, pas l'usage. */
  if (!(await rateLimit(`social:${user.id}`, 300, 3_600_000)))
    return bad("Trop d'actions — réessaie dans un moment", 429);

  const social = store("social");
  const state =
    ((await social.get(`s:${user.id}`, { type: "json" })) as Record<
      string,
      string[]
    >) ?? {};
  const set = new Set(state[kind] ?? []);
  /* Vrai changement d'état ? Toggler deux fois ne doit pas renotifier :
     c'est l'autre moitié du correctif anti-boucle ci-dessus. */
  const changed = b?.on ? !set.has(id) : set.has(id);
  if (b?.on) set.add(id);
  else set.delete(id);
  if (set.size > 2000) return bad("Limite atteinte", 429); // anti-spam simple
  state[kind] = [...set];
  await social.setJSON(`s:${user.id}`, state);

  // Compteur global de likes (map unique — approximation assumée en beta).
  if (kind === "liked" && changed) {
    /* `changed` est indispensable ici : sans lui, aimer deux fois de suite
       incrémente deux fois un compteur que l'ensemble ne compte qu'une. */
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
    if (b?.on && changed) {
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
  if (kind === "follows" && b?.on && changed) {
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
