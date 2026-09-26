/* /api/me/avatar — photo de profil du membre connecté.

   POST   {image: "data:image/jpeg;base64,…"} → nouvelle photo. Le JPEG est
          nettoyé côté serveur (plus d'EXIF ni de position GPS) avant
          d'être stocké ; l'ancienne photo est effacée.
   DELETE → retire la photo. Permis même à un membre suspendu : c'est une
          mesure de confidentialité, pas une publication. */
import type { Config } from "@netlify/functions";
import {
  json,
  bad,
  currentUser,
  sameOrigin,
  readJson,
  rateLimit,
  assertCanWrite,
} from "./_shared/core.mts";
import { updateUser } from "./_shared/users.mts";
import { deleteImage, storeAvatar } from "./_shared/media.mts";
import { isAvatarPath } from "../../src/lib/avatar.ts";

const LOCKED =
  "Ta photo a été masquée par la modération. Tu ne peux pas en publier une nouvelle pour l'instant.";

const conflict = () =>
  json(
    { error: "Ton profil vient d'être modifié. Réessaie.", code: "conflict" },
    409,
  );

export default async (req: Request) => {
  if (req.method !== "POST" && req.method !== "DELETE")
    return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);

  if (req.method === "DELETE") {
    const u = await updateUser(user.id, (rec) => {
      if (rec.avatar === undefined && rec.avatarHidden === undefined)
        return null; // rien à retirer
      const r = { ...rec };
      delete r.avatar;
      delete r.avatarHidden; // avatarLocked, lui, reste posé
      return r;
    });
    if (!u.ok && u.reason !== "aborted") return conflict();
    if (u.ok) await deleteImage(u.prev.avatar);
    return json({ ok: true, avatar: null });
  }

  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;
  const body = await readJson<{ image?: unknown }>(req);
  if (!(await rateLimit(`avatar:${user.id}`, 10, 86_400_000)))
    return json(
      { error: "Trop d'essais. Réessaie demain.", code: "rate" },
      429,
    );
  if (user.avatarLocked) return json({ error: LOCKED, code: "locked" }, 403);

  const stored = await storeAvatar(body?.image);
  if (!stored.ok) return bad(stored.message, 400);

  const u = await updateUser(user.id, (rec) =>
    rec.avatarLocked
      ? null
      : { ...rec, avatar: stored.path, avatarHidden: false },
  );
  if (!u.ok) {
    await deleteImage(stored.path);
    return u.reason === "aborted"
      ? json({ error: LOCKED, code: "locked" }, 403)
      : conflict();
  }

  // L'ancienne, lue sur l'enregistrement que l'écriture a remplacé.
  const old = u.prev.avatar;
  if (isAvatarPath(old) && old !== stored.path) await deleteImage(old);

  return json({ ok: true, avatar: stored.path });
};

export const config: Config = { path: "/api/me/avatar" };
