/* GET /api/members?handles=a,b — handle actuel, nom et photo de membres
   désignés par handle (favoris, message direct ouvert par lien). Jamais
   l'e-mail.

   Un ancien handle n'y figure que pendant le renvoi choisi par son
   titulaire, comme sur /api/profile ; un handle inconnu, supprimé ou
   sans renvoi est simplement absent de la réponse. */
import type { Config } from "@netlify/functions";
import { bad, json } from "./_shared/core.mts";
import {
  MEMBERS_CONCURRENCY,
  mapLimit,
  readUsers,
} from "./_shared/members.mts";
import { resolveHandle } from "./_shared/users.mts";
import { normalizeHandle, publicHandleTarget } from "../../src/lib/handle.ts";
import { toPublicMember, type PublicMember } from "../../src/lib/members.ts";

const MAX_HANDLES = 50;

export default async (req: Request) => {
  if (req.method !== "GET") return bad("Méthode non autorisée", 405);
  const raw = new URL(req.url).searchParams.get("handles") ?? "";
  const handles = [
    ...new Set(
      raw
        .split(",")
        .map(normalizeHandle)
        .filter((h) => /^[a-z0-9._-]{1,30}$/.test(h)),
    ),
  ].slice(0, MAX_HANDLES);

  const ids = await mapLimit(handles, MEMBERS_CONCURRENCY, (h) =>
    resolveHandle(h),
  );
  const recs = await readUsers(ids.filter((id): id is string => id !== null));
  const now = Date.now();
  const members: [string, PublicMember][] = [];
  handles.forEach((h, i) => {
    const id = ids[i];
    const rec = id ? recs.get(id) : null;
    if (!id || !rec || publicHandleTarget(rec, h, now) === "hidden") return;
    const m = toPublicMember({ ...rec, id });
    if (m) members.push([h, m]);
  });
  // fromEntries : un handle comme « __proto__ » reste une clé ordinaire
  return json({ members: Object.fromEntries(members) });
};

export const config: Config = { path: "/api/members" };
