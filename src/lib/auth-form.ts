/* ============================================================
   SOLANGE — écran de connexion : ce qui manque pour recevoir le code,
   et les délais du code.

   Les deux durées reprennent netlify/functions/auth-send-code.mts :
   `exp: now + 10 * 60_000` et 60 s entre deux envois pour une même
   adresse. Si le serveur change, changer ici aussi.
   ============================================================ */

import { MIN_AGE } from "./legal";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validité du code envoyé, en minutes. */
export const CODE_VALIDITY_MIN = 10;

/** Délai avant de pouvoir redemander un code, en secondes. */
export const RESEND_DELAY_S = 60;

export type Missing = "email" | "legal" | "age";

/** Ce qui manque encore, dans l'ordre de l'écran. */
export function missingForCode(f: {
  email: string;
  acceptLegal: boolean;
  ageDeclared: boolean;
}): Missing[] {
  const out: Missing[] = [];
  if (!EMAIL_RE.test(f.email.trim())) out.push("email");
  if (!f.acceptLegal) out.push("legal");
  if (!f.ageDeclared) out.push("age");
  return out;
}

const ACTION: Record<Missing, string> = {
  email: "entre une adresse email valide",
  legal: "accepte les conditions",
  age: `déclare avoir ${MIN_AGE} ans ou plus`,
};

/** Une phrase qui dit quoi faire, ou null s'il ne manque rien. */
export function missingMessage(missing: readonly Missing[]): string | null {
  if (missing.length === 0) return null;
  const actions = missing.map((m) => ACTION[m]);
  const last = actions.pop();
  const list = actions.length ? `${actions.join(", ")} et ${last}` : last;
  return `Pour recevoir le code, ${list}.`;
}

/** Secondes à attendre avant de pouvoir renvoyer un code (0 = possible). */
export function resendWait(
  sentAt: number | null,
  now: number,
  delayS: number = RESEND_DELAY_S,
): number {
  if (sentAt === null) return 0;
  return Math.max(0, Math.ceil((sentAt + delayS * 1000 - now) / 1000));
}
