/* ============================================================
   SOLANGE — ce que les autres membres voient d'un compte. Fonctions
   PURES, partagées client (types) / serveur (projection et recouvrement
   des pages lues, importé avec l'extension .ts). Testées dans
   src/lib/__tests__/members.test.ts.

   Pseudo, nom et photo se relisent depuis le compte (par son id) au
   moment de la lecture : la copie stockée dans une annonce, un post ou
   une conversation ne sert que de repli.
   ============================================================ */

import { isAvatarPath } from "./avatar";
import { DELETED_HANDLE } from "./handle";

export type PublicMember = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
};

/** Liste blanche stricte : rien d'autre ne quitte le serveur (ni e-mail,
    ni consentement, ni compte de paiement, ni rôle, ni anciens handles).
    Une photo masquée par la modération ou un chemin douteux donne null. */
export function toPublicMember(
  rec: {
    id: string;
    handle: string;
    name: string;
    avatar?: string;
    avatarHidden?: boolean;
  } | null,
): PublicMember | null {
  if (!rec) return null;
  return {
    id: rec.id,
    handle: rec.handle,
    name: rec.name,
    avatar: !rec.avatarHidden && isAvatarPath(rec.avatar) ? rec.avatar : null,
  };
}

export const DELETED_MEMBER: Omit<PublicMember, "id"> = {
  handle: DELETED_HANDLE,
  name: "Membre supprimé",
  avatar: null,
};

/** id → membre. `null` : compte confirmé absent (supprimé). Clé absente :
    non résolu (plafond de lectures), la valeur stockée reste. */
export type MemberMap = Map<string, PublicMember | null>;

/** Recouvre les champs d'auteur d'un enregistrement. `f` nomme ses champs
    (ex. `{id: "authorId", handle: "authorHandle", name: "authorName",
    avatar: "authorAvatar"}`). Sans `avatar`, seuls handle et nom sont
    touchés. */
export function overlayMember<T extends Record<string, unknown>>(
  rec: T,
  f: { id: string; handle: string; name?: string; avatar?: string },
  map: MemberMap,
): T {
  const id = rec[f.id];
  const out: Record<string, unknown> = { ...rec };
  const m =
    typeof id === "string" && id !== "" && map.has(id) ? map.get(id) : undefined;
  if (m === undefined) {
    if (f.avatar) out[f.avatar] = null;
    return out as T;
  }
  const shown = m ?? DELETED_MEMBER;
  out[f.handle] = shown.handle;
  if (f.name) out[f.name] = shown.name;
  if (f.avatar) out[f.avatar] = shown.avatar;
  return out as T;
}

/** Les ids d'une page, dans l'ordre, sans doublon ni vide. */
export function idsOf(recs: Record<string, unknown>[], fields: string[]): string[] {
  const out = new Set<string>();
  for (const r of recs)
    for (const k of fields) {
      const v = r[k];
      if (typeof v === "string" && v !== "") out.add(v);
    }
  return [...out];
}
