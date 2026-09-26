/* POST /api/me/handle — changer d'@identifiant, une fois tous les 90 jours.
   {handle: string, redirect?: boolean}

   Un handle ne change jamais de propriétaire : l'ancien reste attaché au
   compte (alias) et ne mène publiquement au profil que si le membre a
   coché le renvoi (30 jours). Déroulé, pour qu'un double envoi ou une
   coupure ne libère jamais un handle encore utilisé :
   1. verrou `pendingHandle` sur le compte (écriture conditionnelle) ;
   2. réservation `handle:<v>` par création seule (`onlyIfNew`) ;
   3. bascule du compte, si le verrou est toujours le nôtre ;
   4. en cas d'échec, on ne rend la réservation que si le compte relu ne
      l'utilise pas (shouldReleaseReservation). */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  currentUser,
  sameOrigin,
  readJson,
  rateLimit,
  assertCanWrite,
  type UserRecord,
} from "./_shared/core.mts";
import { updateUser } from "./_shared/users.mts";
import { appendRename } from "./_shared/handle-migrate.mts";
import {
  HANDLE_COOLDOWN_MS,
  checkHandleChange,
  nextHandleHistory,
  normalizeHandle,
  shouldReleaseReservation,
  type HandleCheck,
} from "../../src/lib/handle.ts";

const refuse = (c: Extract<HandleCheck, { ok: false }>) =>
  json(
    {
      error: c.message,
      code: c.code,
      ...(c.nextHandleChangeAt
        ? { nextHandleChangeAt: c.nextHandleChangeAt }
        : {}),
    },
    c.status,
  );

const conflict = () =>
  json(
    { error: "Ton profil vient d'être modifié. Réessaie.", code: "conflict" },
    409,
  );

/** Une écriture conditionnelle a renoncé : la vraie raison (délai,
    changement en cours) si on l'a vue, sinon un conflit. */
const refuseOrConflict = (c: HandleCheck | undefined) =>
  c && !c.ok ? refuse(c) : conflict();

const taken = () =>
  json({ error: "Cet identifiant est déjà pris.", code: "taken" }, 409);

/** Retire notre verrou, et seulement le nôtre. */
const releaseLock = (id: string, token: string) =>
  updateUser(id, (rec) => {
    if (rec.pendingHandle?.token !== token) return null;
    const r = { ...rec };
    delete r.pendingHandle;
    return r;
  });

/** Rend `handle:<h>` s'il mène au membre et que son compte (`rec`, ou
    relu) ne l'utilise ni comme handle, ni comme alias, ni en attente.
    Une réservation qui ne figure nulle part sur le compte échapperait à la
    pierre tombale posée à sa suppression. */
async function releaseReservation(
  users: ReturnType<typeof store>,
  id: string,
  h: string,
  rec?: UserRecord,
) {
  if ((await users.get(`handle:${h}`, { type: "text" })) !== id) return;
  const cur =
    rec ??
    ((await users.get(`u:${id}`, { type: "json" })) as UserRecord | null);
  if (shouldReleaseReservation(cur, h)) await users.delete(`handle:${h}`);
}

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connexion requise", 401);
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;

  const body = await readJson<{ handle?: unknown; redirect?: unknown }>(req);
  if (!(await rateLimit(`handle:${user.id}`, 10, 86_400_000)))
    return json(
      { error: "Trop d'essais. Réessaie demain.", code: "rate" },
      429,
    );

  const now = Date.now();
  const v = normalizeHandle(body?.handle);
  const pre = checkHandleChange(user, v, now);
  if (!pre.ok) return refuse(pre);

  const id = user.id;
  const users = store("users");
  const key = `handle:${v}`;
  const token = newId("hp");
  const reclaim = pre.reclaim;

  if (reclaim) {
    // Un ancien handle du membre : sa clé doit toujours pointer vers lui.
    if ((await users.get(key, { type: "text" })) !== id) return taken();
  } else {
    // a. Verrou.
    const lock: { check?: HandleCheck } = {};
    const a = await updateUser(id, (rec) => {
      lock.check = checkHandleChange(rec, v, now);
      return lock.check.ok
        ? { ...rec, pendingHandle: { h: v, token, at: now } }
        : null;
    });
    if (!a.ok) return refuseOrConflict(lock.check);

    // b. Réservation laissée par une tentative coupée sur un autre handle.
    const stale = a.prev.pendingHandle;
    if (stale && stale.h !== v)
      await releaseReservation(users, id, stale.h, a.rec);

    // c. Réservation. Déjà à nous : reste d'une tentative coupée sur v.
    const res = await users.set(key, id, { onlyIfNew: true });
    if (!res.modified && (await users.get(key, { type: "text" })) !== id) {
      await releaseLock(id, token);
      return taken();
    }
  }

  // Finalisation.
  const fin: { check?: HandleCheck } = {};
  const f = await updateUser(id, (rec) => {
    if (!reclaim && rec.pendingHandle?.token !== token) return null;
    fin.check = checkHandleChange({ ...rec, pendingHandle: undefined }, v, now);
    if (!fin.check.ok) return null;
    const r: UserRecord = { ...rec };
    delete r.pendingHandle;
    return {
      ...r,
      handle: v,
      handleChangedAt: now,
      handleHistory: nextHandleHistory(
        rec.handleHistory,
        rec.handle,
        v,
        now,
        body?.redirect === true,
      ),
    };
  });

  if (!f.ok) {
    /* Hors reprise, `handle:<v>` est à nous, créé ici ou resté d'une
       tentative coupée sur le même v : rendu dans les deux cas si le
       compte relu ne l'utilise pas. */
    if (!reclaim) {
      await releaseLock(id, token);
      await releaseReservation(users, id, v);
    }
    return refuseOrConflict(fin.check);
  }

  /* Une tentative coupée sur un autre handle, dont la finalisation vient
     d'effacer le verrou (cas de la reprise, qui n'en pose pas) : sa
     réservation est rendue, comme à l'étape b. */
  const stale = f.prev.pendingHandle;
  if (stale && stale.h !== v)
    await releaseReservation(users, id, stale.h, f.rec);

  /* Filet : la clé du handle désormais actuel doit exister. Une annulation
     concurrente d'une autre tentative du même membre a pu l'effacer entre
     sa relecture et sa suppression ; création seule, jamais d'écrasement. */
  await users.set(key, id, { onlyIfNew: true });

  try {
    await appendRename({
      from: f.prev.handle,
      to: v,
      at: now,
      redirect: body?.redirect === true,
    });
  } catch {
    // au mieux : me.mts, social.mts et le balayage rattrapent sans lui
    console.error("rename_log_error");
  }

  return json({
    ok: true,
    handle: v,
    handleChangedAt: now,
    nextHandleChangeAt: now + HANDLE_COOLDOWN_MS,
  });
};

export const config: Config = { path: "/api/me/handle" };
