import type { ApiNotif } from "./api";

/** /decouvrir, /article/…, /checkout/… : on est au Marché. */
export function dansMarche(pathname: string): boolean {
  return /^\/(decouvrir|article|checkout)(\/|$)/.test(pathname);
}

/** /article/… : la barre d'achat prend la place de la barre d'onglets. */
export function sansBarreOnglets(pathname: string): boolean {
  return pathname.startsWith("/article/");
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
