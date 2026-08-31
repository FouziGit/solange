/* POST /api/legal/accept — enregistre l'acceptation des conditions par un
   membre déjà connecté (première acceptation pour les comptes créés avant
   la mise en place du dispositif, ou réacceptation après changement de
   version).

   La version enregistrée est celle du SERVEUR : le client dit « j'accepte »,
   il ne choisit pas ce qu'il accepte. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  sameOrigin,
  readJson,
  currentUser,
} from "./_shared/core.mts";
import {
  acceptancePayloadIsValid,
  buildConsent,
} from "../../src/lib/legal-consent.ts";

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);

  const user = await currentUser(req);
  if (!user) return bad("Connecte-toi pour continuer", 401);

  const body = await readJson<unknown>(req);
  if (!acceptancePayloadIsValid(body))
    return bad(
      "Tu dois accepter les conditions et déclarer ton âge pour continuer.",
      400,
    );

  const users = store("users");
  const current = (await users.get(`u:${user.id}`, { type: "json" })) as Record<
    string,
    unknown
  > | null;
  if (!current) return bad("Compte introuvable", 404);

  const legal = buildConsent(Date.now());
  await users.setJSON(`u:${user.id}`, { ...current, legal });

  return json({ ok: true, legal });
};

export const config: Config = { path: "/api/legal/accept" };
