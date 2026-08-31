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
  | "ban"; // bannir l'auteur

export const MOD_ACTION_LABEL: Record<ModAction, string> = {
  dismiss: "Classer",
  warn: "Avertir",
  hide: "Masquer",
  suspend: "Suspendre",
  ban: "Bannir",
};

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
