/* POST /api/legal/accept — enregistre l'acceptation des conditions par un
   membre déjà connecté (première acceptation pour les comptes créés avant
   la mise en place du dispositif, ou réacceptation après changement de
   version).

   La version enregistrée est celle du SERVEUR : le client dit « j'accepte »,
   il ne choisit pas ce qu'il accepte. */
import type { Config } from "@netlify/functions";
import {
  json,
  bad,
  sameOrigin,
  readJson,
  currentUser,
} from "./_shared/core.mts";
import { updateUser } from "./_shared/users.mts";
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

  // Fusion sur l'enregistrement frais : une photo ou un identifiant
  // changés au même instant ne sont pas écrasés.
  const legal = buildConsent(Date.now());
  const u = await updateUser(user.id, (r) => ({ ...r, legal }));
  if (!u.ok)
    return u.reason === "missing"
      ? bad("Compte introuvable", 404)
      : bad("Ton compte vient d'être modifié. Réessaie.", 409);

  return json({ ok: true, legal });
};

export const config: Config = { path: "/api/legal/accept" };
