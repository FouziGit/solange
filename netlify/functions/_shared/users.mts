/* Comptes : résolution d'un @handle et réécriture sûre de `u:<id>`.

   Deux règles, tirées de la spécification profil :
   - un handle ne change jamais de propriétaire. `handle:<h>` pointe vers
     un id, ou vers une pierre tombale après suppression du compte ; tout
     lecteur passe par `resolveHandle`, qui ne rend qu'un id valide ;
   - `u:<id>` ne se réécrit qu'en écriture conditionnelle (etag). Deux
     écritures simultanées (photo et consentement, par exemple) ne
     s'écrasent plus : la seconde repart de l'enregistrement frais. */
import {
  nextHandleChangeAt,
  normalizeHandle,
} from "../../../src/lib/handle.ts";
import { isAvatarPath } from "../../../src/lib/avatar.ts";
import { toPublicMember } from "../../../src/lib/members.ts";
import { store, type UserRecord } from "./core.mts";

/** Valeur de `handle:<h>` d'un compte supprimé : le handle reste pris,
    il ne désigne plus personne. */
export const HANDLE_TOMBSTONE = "!deleted";

/** Ce dont ces fonctions ont besoin d'un store Blobs (un faux en test). */
export type UserStoreLike = {
  getWithMetadata(
    k: string,
    o: { type: "json" },
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    k: string,
    v: unknown,
    o?: { onlyIfMatch?: string },
  ): Promise<{ modified: boolean }>;
  get(k: string, o: { type: "text" }): Promise<string | null>;
};

const USER_ID = /^u_[a-f0-9]{12}$/;

/** L'id du membre qui détient `h` (handle actuel ou ancien). null si la
    clé est absente, porte une pierre tombale ou tout autre valeur. */
export async function resolveHandle(
  h: string,
  users?: UserStoreLike,
): Promise<string | null> {
  const k = normalizeHandle(h);
  if (!k) return null;
  const v = await (users ?? store("users")).get(`handle:${k}`, {
    type: "text",
  });
  return typeof v === "string" && USER_ID.test(v) ? v : null;
}

export type UpdateUserResult =
  | { ok: true; rec: UserRecord; prev: UserRecord }
  | { ok: false; reason: "missing" | "aborted" | "conflict" };

/** Réécrit `u:<id>` par écriture conditionnelle. `mutate` reçoit une copie
    de l'enregistrement frais et rend le nouveau (null : on renonce).
    `prev` est l'enregistrement sur lequel l'écriture réussie s'est
    appuyée. Sans etag, on n'écrit pas : c'est un conflit. */
export async function updateUser(
  id: string,
  mutate: (rec: UserRecord) => UserRecord | null,
  opts?: { tries?: number; users?: UserStoreLike },
): Promise<UpdateUserResult> {
  const users = opts?.users ?? store("users");
  const tries = Math.max(1, opts?.tries ?? 3);
  const key = `u:${id}`;
  for (let i = 0; i < tries; i++) {
    const cur = await users.getWithMetadata(key, { type: "json" });
    if (!cur || !cur.data || typeof cur.data !== "object")
      return { ok: false, reason: "missing" };
    if (!cur.etag) return { ok: false, reason: "conflict" };
    const prev = cur.data as UserRecord;
    const next = mutate(structuredClone(prev));
    if (!next) return { ok: false, reason: "aborted" };
    const res = await users.setJSON(key, next, { onlyIfMatch: cur.etag });
    if (res.modified) return { ok: true, rec: next, prev };
  }
  return { ok: false, reason: "conflict" };
}

/** Champs de profil renvoyés au membre lui-même (/api/me, connexion). Une
    photo masquée par la modération n'est pas renvoyée ; `avatarHidden`
    dit seulement qu'elle est encore gardée, donc qu'il peut la retirer.
    Les anciens identifiants ne partent qu'à leur titulaire : il peut les
    reprendre, même s'ils ne respectent plus les règles actuelles. */
export function profileFields(rec: UserRecord) {
  return {
    avatar: toPublicMember(rec)?.avatar ?? null,
    avatarHidden: rec.avatarHidden === true && isAvatarPath(rec.avatar),
    avatarLocked: rec.avatarLocked === true,
    handleChangedAt: rec.handleChangedAt ?? null,
    nextHandleChangeAt: nextHandleChangeAt(rec.handleChangedAt),
    formerHandles: (rec.handleHistory ?? []).map((a) => a.h),
  };
}
