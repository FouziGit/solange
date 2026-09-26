/* Résolution des membres à la lecture. Pseudo, nom et photo se relisent
   depuis u:<id> : la copie stockée dans une annonce, un post, un fil, une
   conversation ou une commande ne sert que de repli (catalogue seed,
   fil anonymisé, page trop peuplée).

   Bornée : 100 comptes au plus par page, 10 lectures à la fois. */
import { store, type UserRecord } from "./core.mts";
import type { UserStoreLike } from "./users.mts";
import {
  idsOf,
  overlayMember,
  toPublicMember,
  type MemberMap,
} from "../../../src/lib/members.ts";

export const MEMBERS_MAX = 100;
export const MEMBERS_CONCURRENCY = 10;

/* Seul un id de compte se relit : une valeur d'une autre forme (vide,
   vendeur seed) n'est pas un compte supprimé, elle reste non résolue. */
const USER_ID = /^u_[a-f0-9]{12}$/;

/** Applique `fn` à chaque élément, `limit` appels à la fois au plus.
    L'ordre des résultats suit celui des éléments. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  const n = Math.min(Math.max(1, Math.floor(limit)), items.length);
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

type ReadOpts = { users?: UserStoreLike; concurrency?: number; max?: number };

/** Comptes complets (serveur uniquement : e-mail et historique compris).
    `null` : compte absent. Au-delà de `max`, les ids ne sont pas lus. */
export async function readUsers(
  ids: string[],
  opts: ReadOpts = {},
): Promise<Map<string, UserRecord | null>> {
  const users = opts.users ?? store("users");
  const todo = [...new Set(ids)]
    .filter((id) => USER_ID.test(id))
    .slice(0, opts.max ?? MEMBERS_MAX);
  const recs = await mapLimit(
    todo,
    opts.concurrency ?? MEMBERS_CONCURRENCY,
    async (id) => {
      const r = await users.getWithMetadata(`u:${id}`, { type: "json" });
      return r?.data && typeof r.data === "object"
        ? (r.data as UserRecord)
        : null;
    },
  );
  return new Map(todo.map((id, i) => [id, recs[i]]));
}

/** Ce que les autres membres voient de ces comptes. `null` : compte
    supprimé ; id absent de la table : non résolu, la valeur stockée
    reste. */
export async function resolveMembers(
  ids: string[],
  opts: ReadOpts = {},
): Promise<MemberMap> {
  const recs = await readUsers(ids, opts);
  const map: MemberMap = new Map();
  for (const [id, rec] of recs) map.set(id, toPublicMember(rec));
  return map;
}

/* ---------- champs recouverts, par type d'enregistrement ---------- */

/** Noms des champs d'un auteur dans un enregistrement (id, handle, nom,
    photo), tels que les attend overlayMember. */
export type MemberFields = Parameters<typeof overlayMember>[1];

/** Posts du feed, fils et réponses des Cercles. */
export const AUTHOR: MemberFields = {
  id: "authorId",
  handle: "authorHandle",
  name: "authorName",
  avatar: "authorAvatar",
};
/** Annonces : le vendeur n'a pas de nom stocké. */
export const PRODUCT_SELLER: MemberFields = {
  id: "sellerId",
  handle: "seller",
  avatar: "sellerAvatar",
};
export const CONV_BUYER: MemberFields = {
  id: "buyerId",
  handle: "buyerHandle",
  avatar: "buyerAvatar",
};
export const CONV_SELLER: MemberFields = {
  id: "sellerId",
  handle: "sellerHandle",
  avatar: "sellerAvatar",
};
/** Commandes : handles seulement. */
export const ORDER_BUYER: MemberFields = {
  id: "buyerId",
  handle: "buyerHandle",
};
export const ORDER_SELLER: MemberFields = {
  id: "sellerId",
  handle: "sellerHandle",
};

/** Recouvre chaque enregistrement pour chaque couple de champs. */
export function overlayMembers<T extends Record<string, unknown>>(
  recs: T[],
  fields: MemberFields[],
  map: MemberMap,
): T[] {
  return recs.map((r) =>
    fields.reduce((acc, f) => overlayMember(acc, f, map), r),
  );
}

/** Une page lue : ses ids, une résolution, le recouvrement. Les ids sont
    pris dans l'ordre de la page : au-delà du plafond, ce sont les
    derniers qui gardent leur valeur stockée. */
export async function withMembers<T extends Record<string, unknown>>(
  recs: T[],
  fields: MemberFields[],
  opts: ReadOpts = {},
): Promise<T[]> {
  const map = await resolveMembers(
    idsOf(
      recs,
      fields.map((f) => f.id),
    ),
    opts,
  );
  return overlayMembers(recs, fields, map);
}
