import type { ApiNotif } from "./api";

/** /decouvrir, /article/…, /checkout/… : on est au Marché. */
export function dansMarche(pathname: string): boolean {
  return /^\/(decouvrir|article|checkout)(\/|$)/.test(pathname);
}

/** /profil, et les écrans qui s'ouvrent depuis lui : Gardées, Cercles,
    Journal. Ils n'ont pas de lien de retour : l'onglet dit où l'on est. */
export function dansProfil(pathname: string): boolean {
  return /^\/(profil|favoris|communaute|journal)(\/|$)/.test(pathname);
}

/** /article/<id> : la barre d'achat prend la place de la barre d'onglets.
    Seulement si la pièce existe : sur la 404, rien ne la remplacerait. */
export function sansBarreOnglets(
  pathname: string,
  pieceExiste: (id: string) => boolean,
): boolean {
  const id = /^\/article\/([^/]+)$/.exec(pathname)?.[1];
  return id !== undefined && pieceExiste(id);
}

/** Date (horloge du serveur) de la dernière notification de message ;
    0 s'il n'y en a pas. */
export function dernierMessage(
  notifs: readonly Pick<ApiNotif, "type" | "at">[],
): number {
  return Math.max(
    0,
    ...notifs.filter((n) => n.type === "message").map((n) => n.at),
  );
}

/** Une notification de message non lue, plus récente que `vuA`. */
export function messageNonLu(
  notifs: readonly Pick<ApiNotif, "type" | "read" | "at">[],
  vuA = 0,
): boolean {
  return notifs.some((n) => n.type === "message" && !n.read && n.at > vuA);
}
