/* ============================================================
   SOLANGE — un membre à l'écran : sa photo, le lien vers son profil,
   l'interlocuteur d'une conversation, les vendeurs suivis. Fonctions
   PURES, testées dans src/lib/__tests__/member-display.test.ts.

   Graine = id du compte : le dégradé d'un membre ne change plus quand
   il change d'@identifiant, et aucun contenu de membre ne peut prendre
   le portrait d'un créateur de démonstration.
   ============================================================ */

import type { ApiConversation, ModReportItem } from "./api";
import { DELETED_HANDLE, normalizeHandle } from "./handle";
import type { PublicMember } from "./members";
import { MOD_ACTION_LABEL } from "./moderation";

/** Graine et photo de l'avatar d'un auteur. Compte connu (id) : sa photo,
    ou ses initiales. Sans id (démo, contenu anonymisé) : initiales sur la
    graine du handle, jamais de portrait. */
export function authorAvatar(
  id: string | null | undefined,
  handle: string,
  avatar: string | null | undefined,
): { seed: string; src: string | null } {
  return id ? { seed: id, src: avatar ?? null } : { seed: handle, src: null };
}

/** Un compte supprimé n'a plus de profil : pas de lien vers une page
    vide. */
export function hasProfile(handle: string): boolean {
  return handle !== "" && handle !== DELETED_HANDLE;
}

/** L'autre partie d'une conversation serveur : l'acheteur quand je vends,
    le vendeur sinon. */
export function conversationPeer(
  c: Pick<
    ApiConversation,
    | "role"
    | "buyerId"
    | "buyerHandle"
    | "buyerAvatar"
    | "sellerId"
    | "sellerHandle"
    | "sellerAvatar"
  >,
): { id: string | null; handle: string; avatar: string | null } {
  return c.role === "seller"
    ? {
        id: c.buyerId || null,
        handle: c.buyerHandle,
        avatar: c.buyerAvatar ?? null,
      }
    : {
        id: c.sellerId || null,
        handle: c.sellerHandle,
        avatar: c.sellerAvatar ?? null,
      };
}

/** Le membre que api.members() a renvoyé pour ce handle (ses clés sont
    normalisées). Une clé héritée d'Object (« constructor ») n'est pas un
    membre. */
export function memberFor(
  members: Readonly<Record<string, PublicMember>>,
  handle: string,
): PublicMember | null {
  const k = normalizeHandle(handle);
  return Object.hasOwn(members, k) ? members[k] : null;
}

export type DemoCreator = {
  handle: string;
  name: string;
  seed: string;
  verified?: boolean;
};

/** Réponse de api.members() pour les vendeurs suivis. `asked` : handles
    demandés (normalisés). `failed` : la réponse n'est pas arrivée. */
export type MembersLookup = {
  asked: ReadonlySet<string>;
  members: Readonly<Record<string, PublicMember>>;
  failed: boolean;
};

export type FollowedCard = {
  /** Le handle tel qu'il est suivi : c'est lui que « Suivi » bascule. */
  handle: string;
  /** Le handle affiché : l'actuel quand le membre a été trouvé. */
  shown: string;
  name: string;
  seed: string;
  /** undefined : créateur de démo, son portrait peut s'afficher. */
  src?: string | null;
  verified?: boolean;
  /** false : ce handle ne mène plus à aucun profil public. */
  linked: boolean;
};

/** Handles à demander au serveur : tout sauf les créateurs de démo,
    normalisés, sans doublon, triés (clé stable pour un effet). Ce qui ne
    peut pas être un handle ne part pas. */
export function followedToLookUp(
  handles: readonly string[],
  demo: ReadonlyMap<string, DemoCreator>,
): string[] {
  return [
    ...new Set(
      handles
        .filter((h) => !demo.has(h))
        .map(normalizeHandle)
        .filter((h) => /^[a-z0-9._-]{1,30}$/.test(h)),
    ),
  ].sort();
}

/** Fiches des vendeurs suivis. Démo : fiche du mock. Membre trouvé :
    nom, photo et handle actuel. Handle absent d'une réponse reçue : on
    l'affiche sans lien. Tant que la réponse manque (chargement, hors
    ligne), on ne conclut pas à l'absence : fiche minimale, lien gardé.
    On n'invente ni nombre d'abonnés ni badge. */
export function followedCards(
  handles: readonly string[],
  demo: ReadonlyMap<string, DemoCreator>,
  lookup: MembersLookup | null,
): FollowedCard[] {
  return handles.map((h): FollowedCard => {
    const d = demo.get(h);
    if (d)
      return {
        handle: h,
        shown: h,
        name: d.name,
        seed: d.seed,
        verified: d.verified,
        linked: true,
      };
    const k = normalizeHandle(h);
    const m = lookup && !lookup.failed ? memberFor(lookup.members, k) : null;
    if (m)
      return {
        handle: h,
        shown: m.handle,
        name: m.name || m.handle,
        seed: m.id,
        src: m.avatar,
        linked: true,
      };
    const known = lookup !== null && !lookup.failed && lookup.asked.has(k);
    return { handle: h, shown: h, name: h, seed: h, src: null, linked: !known };
  });
}

/* ---------- modération : la photo d'un membre signalé ---------- */

/** Libellé d'une action de modération. Sur un membre signalé, masquer et
    rétablir ne touchent que sa photo de profil : le bouton le dit. */
export function modActionLabel(targetType: string, action: string): string {
  if (targetType === "user" && action === "hide") return "Masquer la photo";
  if (targetType === "user" && action === "unhide") return "Rétablir la photo";
  return Object.hasOwn(MOD_ACTION_LABEL, action)
    ? MOD_ACTION_LABEL[action as keyof typeof MOD_ACTION_LABEL]
    : action;
}

/** Ce qu'on peut faire de la photo d'un membre signalé. À traiter : la
    masquer, si elle est visible. Traité : la rétablir si elle est masquée,
    ou si ce signalement l'a fait masquer (le verrou reste posé même
    quand le membre a retiré sa photo depuis). */
export function photoModAction(
  item: Pick<ModReportItem, "targetType" | "status" | "action" | "context">,
): "hide" | "unhide" | null {
  if (item.targetType !== "user") return null;
  if (item.status === "open")
    return item.context?.image && !item.context.hidden ? "hide" : null;
  return item.context?.hidden || item.action === "hide" ? "unhide" : null;
}
