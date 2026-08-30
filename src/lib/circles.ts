/* ============================================================
   SOLANGE — fils de Cercle (lot 2) : types + fonctions PURES
   partagées client/serveur (tri, mentions, non-lus). Testées
   dans src/lib/__tests__/circles.test.ts.
   ============================================================ */

export type CircleThread = {
  id: string;
  circleId: string;
  authorId: string;
  authorHandle: string;
  authorName: string;
  title: string;
  text?: string;
  image?: string;
  createdAt: number;
  lastActivityAt: number;
  replyCount: number;
  likedBy: string[];
  pinned?: boolean;
  deleted?: boolean;
  /** Serveur uniquement : throttle 1 h des emails de réponse. */
  lastEmailAt?: number;
};

export type CircleReply = {
  id: string;
  authorId: string;
  authorHandle: string;
  text: string;
  at: number;
};

/** Tri d'affichage : épinglés d'abord, puis dernière activité. */
export function sortThreads<
  T extends Pick<CircleThread, "pinned" | "lastActivityAt">,
>(threads: T[]): T[] {
  return [...threads].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) === 0
      ? b.lastActivityAt - a.lastActivityAt
      : (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0),
  );
}

/** @handles mentionnés dans un texte (dédupliqués, sans l'auteur). */
export function extractMentions(text: string, exceptHandle?: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/@([a-z0-9][a-z0-9._-]{1,30})/gi)) {
    const h = m[1].toLowerCase();
    if (h !== exceptHandle?.toLowerCase()) out.add(h);
  }
  return [...out];
}

/** Cercles rejoints avec de l'activité depuis la dernière visite. */
export function unreadCircles(
  joined: string[],
  lastActivityByCircle: Record<string, number>,
  seen: Record<string, number>,
): string[] {
  return joined.filter(
    (id) => (lastActivityByCircle[id] ?? 0) > (seen[id] ?? 0),
  );
}
