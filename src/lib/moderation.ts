/* ============================================================
   SOLANGE — règles de modération (lot 4). Fonctions PURES,
   partagées client (affichage) / serveur (décision). Testées dans
   src/lib/__tests__/moderation.test.ts.
   ============================================================ */

/** Ce que le serveur sait d'un compte pour décider de ses droits. */
export type ModeratedUser = {
  id: string;
  email?: string;
  role?: string;
  /** Horodatage de fin de suspension (ms). Passé = suspension finie. */
  suspendedUntil?: number;
  banned?: boolean;
};

/**
 * Admin ? Deux sources, dans cet ordre :
 * 1. la liste `ADMIN_EMAILS` (source de vérité, révocable sans migration),
 * 2. un `role: "admin"` posé sur le compte (compat D-018, et promotion
 *    future depuis l'interface sans redéploiement).
 * La comparaison ignore la casse et les espaces : une liste écrite à la
 * main ne doit pas échouer pour un espace après une virgule.
 */
export function isAdmin(
  user: ModeratedUser | null,
  adminEmails: string | undefined,
): boolean {
  if (!user || user.banned) return false;
  if (user.role === "admin") return true;
  if (!user.email || !adminEmails) return false;
  const me = user.email.trim().toLowerCase();
  return adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(me);
}

export type WriteVerdict =
  | { allowed: true }
  | { allowed: false; reason: "banned" | "suspended"; until?: number };

/**
 * Ce compte peut-il PUBLIER ? Un banni ne devrait déjà plus avoir de
 * session ; un suspendu lit tout mais n'écrit rien jusqu'à l'échéance.
 */
export function canWrite(
  user: ModeratedUser | null,
  now: number,
): WriteVerdict {
  if (!user) return { allowed: false, reason: "banned" };
  if (user.banned) return { allowed: false, reason: "banned" };
  if (user.suspendedUntil && user.suspendedUntil > now)
    return { allowed: false, reason: "suspended", until: user.suspendedUntil };
  return { allowed: true };
}

/** Message affiché à un membre qui ne peut pas publier. */
export function writeBlockedMessage(v: WriteVerdict): string {
  if (v.allowed) return "";
  if (v.reason === "banned")
    return "Ce compte ne peut plus publier sur SOLANGE.";
  const until = v.until ? new Date(v.until) : null;
  return until
    ? `Publication suspendue jusqu'au ${until.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })}.`
    : "Publication suspendue.";
}

/* ---------- vocabulaire de la file ---------- */

export type ModAction =
  | "dismiss" // classer sans suite
  | "warn" // avertir l'auteur
  | "hide" // masquer le contenu
  | "suspend" // suspendre l'auteur
  | "ban" // bannir l'auteur
  /* Les trois levées. La charte de modération promet qu'une contestation
     fondée « lève la mesure et efface ses effets » — sans ces actions, la
     promesse n'avait aucun support et toute sanction était définitive. */
  | "unhide" // rétablir le contenu
  | "unsuspend" // lever la suspension
  | "unban"; // rouvrir le compte

export const MOD_ACTION_LABEL: Record<ModAction, string> = {
  dismiss: "Classer",
  warn: "Avertir",
  hide: "Masquer",
  suspend: "Suspendre",
  ban: "Bannir",
  unhide: "Rétablir",
  unsuspend: "Lever la suspension",
  unban: "Rouvrir le compte",
};

/** Une action qui ANNULE une mesure. Elle ne se justifie pas de la même
    façon qu'une sanction : c'est une réparation, pas une décision. */
export const MOD_REVERSALS: ModAction[] = ["unhide", "unsuspend", "unban"];

export function isReversal(a: ModAction): boolean {
  return MOD_REVERSALS.includes(a);
}

export type ReportTargetType =
  "product" | "post" | "user" | "message" | "thread";

export const TARGET_LABEL: Record<ReportTargetType, string> = {
  product: "Pièce",
  post: "Publication",
  user: "Membre",
  message: "Message",
  thread: "Fil de Cercle",
};

/** Durées de suspension proposées (jours). */
export const SUSPEND_DAYS = [3, 7, 30] as const;

/** Récidive : combien de signalements visent déjà ce membre ? Par son id
    (`targetUserId`, posé à la création) ou par n'importe lequel de ses
    handles, anciens compris : changer d'identifiant n'efface pas
    l'historique. Seuls les signalements de membre et de message
    comptent ; ceux d'une pièce, d'un post ou d'un fil visent un contenu. */
export function countPriorReports(
  reports: {
    targetType: string;
    targetId: string;
    targetUserId?: string | null;
  }[],
  target: { id?: string; handles: Set<string> },
): number {
  const handles = new Set([...target.handles].map((h) => h.toLowerCase()));
  return reports.filter(
    (r) =>
      (r.targetType === "user" || r.targetType === "message") &&
      ((!!target.id && r.targetUserId === target.id) ||
        (typeof r.targetId === "string" &&
          handles.has(r.targetId.toLowerCase()))),
  ).length;
}
