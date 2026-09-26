/* ============================================================
   SOLANGE — identifiant (@handle) : règles de choix, délai de 90 jours,
   alias et renvois. Fonctions PURES, partagées client (formulaire) /
   serveur (décision, importé avec l'extension .ts). Testées dans
   src/lib/__tests__/handle.test.ts.

   Principe : un handle ne change jamais de propriétaire. L'ancien reste
   attaché au compte (alias) et ne mène publiquement au profil que
   pendant le renvoi choisi par le membre.
   ============================================================ */

import { PORTRAIT_SEEDS } from "./img";
import { canWrite, writeBlockedMessage } from "./moderation";

export const HANDLE_MIN = 2;
export const HANDLE_MAX = 20;
export const HANDLE_COOLDOWN_MS = 90 * 86_400_000;
export const HANDLE_REDIRECT_MS = 30 * 86_400_000;
export const HANDLE_PENDING_TTL_MS = 60_000;
export const RENAME_LOG_TTL_MS = 30 * 86_400_000;
export const DELETED_HANDLE = "membre-supprime";

/** Un ancien handle du membre. `redirectUntil = 0` : aucun renvoi public. */
export type HandleAlias = { h: string; at: number; redirectUntil: number };
export type RenameEntry = {
  from: string;
  to: string;
  at: number;
  /** Le membre a choisi le renvoi public de l'ancien handle. */
  redirect?: boolean;
  swept?: boolean;
};
export type HandleOwner = {
  handle: string;
  handleHistory?: HandleAlias[];
  handleChangedAt?: number;
  pendingHandle?: { h: string; token: string; at: number };
  banned?: boolean;
  suspendedUntil?: number;
  id: string;
};

const CHARS_MESSAGE =
  "Utilise seulement des lettres minuscules, des chiffres, le point, le tiret ou le tiret bas.";

/** Forme canonique d'une saisie : sans espaces autour, sans « @ » initial,
    en minuscules. Tout ce qui n'est pas une chaîne donne "". */
export function normalizeHandle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** Pseudo proposé à l'inscription, tiré de la partie locale de l'e-mail. */
export function handleBaseFromEmail(email: string): string {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 20) || "membre";
  return base;
}

/* Démo, portraits, compte supprimé et mots de service : un membre qui
   les prendrait se ferait passer pour un créateur mis en avant ou pour
   l'équipe. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "lou.archive",
  "maya.curates",
  "samir.fits",
  "theo.grail",
  "neige.vintage",
  "yuki.paris",
  "nouh.archive",
  ...PORTRAIT_SEEDS,
  DELETED_HANDLE,
  "admin",
  "administrateur",
  "solange",
  "moderation",
  "moderateur",
  "support",
  "aide",
  "help",
  "contact",
  "equipe",
  "staff",
  "officiel",
  "securite",
  "api",
  "root",
  "system",
]);

/** `membre-…` est la forme de repli attribuée par le serveur : personne
    ne la choisit. */
export function isReservedHandle(h: string): boolean {
  return RESERVED_HANDLES.has(h) || h.startsWith("membre-");
}

/** Règles d'un identifiant choisi. Premier et dernier caractère
    alphanumériques, jamais deux séparateurs à la suite : la regex des
    mentions (circles.ts) capture ainsi tout l'identifiant. */
export function validateHandle(
  raw: unknown,
): { ok: true; value: string } | { ok: false; message: string } {
  const v = normalizeHandle(raw);
  if (!/^[a-z0-9._-]*$/.test(v)) return { ok: false, message: CHARS_MESSAGE };
  if (v.length < HANDLE_MIN || v.length > HANDLE_MAX)
    return {
      ok: false,
      message: `Ton identifiant doit faire entre ${HANDLE_MIN} et ${HANDLE_MAX} caractères.`,
    };
  if (!/^[a-z0-9]/.test(v) || !/[a-z0-9]$/.test(v))
    return {
      ok: false,
      message:
        "Ton identifiant doit commencer et finir par une lettre ou un chiffre.",
    };
  if (/[._-]{2}/.test(v))
    return {
      ok: false,
      message:
        "Évite deux séparateurs à la suite (point, tiret ou tiret bas).",
    };
  if (isReservedHandle(v))
    return {
      ok: false,
      message: "Cet identifiant est réservé. Choisis-en un autre.",
    };
  return { ok: true, value: v };
}

/** Sans date : le premier changement est libre. Ensuite, 90 jours pile. */
export function canChangeHandle(
  lastAt: number | null | undefined,
  now: number,
): boolean {
  if (lastAt == null) return true;
  return now >= lastAt + HANDLE_COOLDOWN_MS;
}

export function nextHandleChangeAt(
  lastAt: number | null | undefined,
): number | null {
  return lastAt == null ? null : lastAt + HANDLE_COOLDOWN_MS;
}

/** « 1 janvier 2027 », à l'heure de Paris quel que soit le fuseau du
    serveur ou du téléphone. */
export function formatHandleDate(ts: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(ts);
}

/** Le handle actuel et tous les anciens, en minuscules. */
export function handlesOf(
  u: Pick<HandleOwner, "handle" | "handleHistory">,
): Set<string> {
  const out = new Set<string>();
  if (u.handle) out.add(u.handle.toLowerCase());
  for (const a of u.handleHistory ?? []) if (a.h) out.add(a.h.toLowerCase());
  return out;
}

/** Historique après un changement : l'ancien handle y entre (une seule
    fois), le nouveau n'y figure jamais. */
export function nextHandleHistory(
  history: HandleAlias[] | undefined,
  oldH: string,
  newH: string,
  now: number,
  redirect: boolean,
): HandleAlias[] {
  const oldL = oldH.toLowerCase();
  const newL = newH.toLowerCase();
  const seen = new Set([oldL, newL]);
  const out: HandleAlias[] = [];
  for (const a of history ?? []) {
    const h = a.h.toLowerCase();
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push({ ...a, h });
  }
  if (oldL && oldL !== newL)
    out.push({
      h: oldL,
      at: now,
      redirectUntil: redirect ? now + HANDLE_REDIRECT_MS : 0,
    });
  return out;
}

export type HandleCheck =
  | { ok: true; reclaim: boolean }
  | {
      ok: false;
      status: 400 | 403 | 409;
      code: "invalid" | "same" | "blocked" | "cooldown" | "pending";
      message: string;
      nextHandleChangeAt?: number;
    };

/** Le membre `rec` peut-il passer à `v` (déjà normalisé) maintenant ?
    Reprendre un de ses anciens handles (`reclaim`) échappe aux règles de
    format et aux réserves : il est à lui. Le délai, lui, vaut toujours. */
export function checkHandleChange(
  rec: HandleOwner,
  v: string,
  now: number,
): HandleCheck {
  if (v === rec.handle.toLowerCase())
    return {
      ok: false,
      status: 400,
      code: "same",
      message: "C'est déjà ton identifiant.",
    };
  const reclaim = handlesOf(rec).has(v);
  if (!reclaim) {
    const r = validateHandle(v);
    if (!r.ok || r.value !== v)
      return {
        ok: false,
        status: 400,
        code: "invalid",
        message: r.ok ? CHARS_MESSAGE : r.message,
      };
  }
  const verdict = canWrite(rec, now);
  if (!verdict.allowed)
    return {
      ok: false,
      status: 403,
      code: "blocked",
      message: writeBlockedMessage(verdict),
    };
  if (!canChangeHandle(rec.handleChangedAt, now)) {
    const next = nextHandleChangeAt(rec.handleChangedAt) ?? now;
    return {
      ok: false,
      status: 409,
      code: "cooldown",
      message: `Tu pourras changer d'identifiant à partir du ${formatHandleDate(next)}.`,
      nextHandleChangeAt: next,
    };
  }
  if (rec.pendingHandle && now - rec.pendingHandle.at < HANDLE_PENDING_TTL_MS)
    return {
      ok: false,
      status: 409,
      code: "pending",
      message: "Un changement est déjà en cours. Réessaie dans une minute.",
    };
  return { ok: true, reclaim };
}

/** Peut-on effacer la réservation `handle:<h>` de ce membre ? Jamais si
    `h` est devenu son handle, un de ses alias ou son changement en cours :
    c'est ce qui rend l'annulation d'un double envoi sans danger. */
export function shouldReleaseReservation(
  rec: HandleOwner | null,
  h: string,
): boolean {
  return (
    rec !== null &&
    rec.handle !== h &&
    !handlesOf(rec).has(h.toLowerCase()) &&
    rec.pendingHandle?.h !== h
  );
}

/** Ce que voit le public qui demande `requested` : le profil, un renvoi
    vers le handle actuel pendant la fenêtre choisie, ou rien. */
export function publicHandleTarget(
  rec: Pick<HandleOwner, "handle" | "handleHistory">,
  requested: string,
  now: number,
): "canonical" | "redirect" | "hidden" {
  const r = requested.toLowerCase();
  if (r === rec.handle.toLowerCase()) return "canonical";
  const alias = rec.handleHistory?.find((a) => a.h.toLowerCase() === r);
  return alias && alias.redirectUntil > now ? "redirect" : "hidden";
}

/** L'expéditeur figure-t-il dans cette liste de blocage, sous son handle
    actuel ou sous n'importe lequel de ses anciens ? */
export function isBlockedBy(
  blocked: string[] | undefined,
  sender: Pick<HandleOwner, "handle" | "handleHistory">,
): boolean {
  if (!blocked?.length) return false;
  const mine = handlesOf(sender);
  return blocked.some((b) => mine.has(normalizeHandle(b)));
}

/** Réécrit une liste de handles (abonnements, blocages) avec le journal
    des changements, dans l'ordre chronologique : A→B puis B→A redonne A.
    Rejouer le même journal ne change plus rien. */
export function applyRenames(
  list: string[],
  log: RenameEntry[],
): { list: string[]; changed: boolean } {
  let cur = list.map(normalizeHandle).filter((h) => h !== "");
  const present = new Set(cur);
  for (const e of [...log].sort((a, b) => a.at - b.at)) {
    const from = normalizeHandle(e.from);
    const to = normalizeHandle(e.to);
    if (!from || !to || from === to || !present.has(from)) continue;
    cur = cur.map((h) => (h === from ? to : h));
    present.delete(from);
    present.add(to);
  }
  const out = [...new Set(cur)];
  const changed =
    out.length !== list.length || out.some((h, i) => h !== list[i]);
  return { list: out, changed };
}

/** Les changements que les abonnements et blocages peuvent suivre : ceux
    dont le membre a choisi le renvoi. Suivre un changement sans renvoi
    montrerait le nouveau handle à quiconque ajoute l'ancien à sa liste. */
export function publicRenames(log: RenameEntry[]): RenameEntry[] {
  return log.filter((e) => e.redirect === true);
}

export function pruneRenameLog(
  log: RenameEntry[],
  now: number,
): RenameEntry[] {
  return log.filter((e) => e.at > now - RENAME_LOG_TTL_MS);
}

/** Chemin du profil canonique quand on est arrivé par un autre handle. */
export function profileRedirect(
  requested: string,
  canonical: string,
): string | null {
  if (!canonical || requested.toLowerCase() === canonical.toLowerCase())
    return null;
  return `/membre/${encodeURIComponent(canonical)}`;
}
