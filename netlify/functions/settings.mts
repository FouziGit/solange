/* /api/settings — préférences du membre.
   GET → {dmOpen} ; POST {dmOpen:boolean} → sauvegarde.
   dmOpen (défaut true) : accepter les messages directs sans annonce. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  currentUser,
  sameOrigin,
  readJson,
} from "./_shared/core.mts";

export type Settings = { dmOpen: boolean };

export async function userSettings(userId: string): Promise<Settings> {
  const s = (await store("users").get(`set:${userId}`, {
    type: "json",
  })) as Partial<Settings> | null;
  return { dmOpen: s?.dmOpen ?? true };
}

export default async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);

  if (req.method === "GET") return json(await userSettings(user.id));

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const b = await readJson<{ dmOpen?: boolean }>(req);
  if (typeof b?.dmOpen !== "boolean") return bad("Réglage invalide");
  await store("users").setJSON(`set:${user.id}`, { dmOpen: b.dmOpen });
  return json({ ok: true, dmOpen: b.dmOpen });
};

export const config: Config = { path: "/api/settings" };
