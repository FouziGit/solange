/* ============================================================
   Compte à rebours des drops — logique pure (testée sans DOM).

   Le décompte part d'une échéance fixe : il ne retranche pas une
   seconde à chaque tick (un onglet en arrière-plan ralentit les
   minuteurs, et le compteur prendrait du retard).

   Sous « Réduire les animations », il ne se fige jamais (une valeur
   figée devient fausse au bout d'une minute) : il passe à la minute
   (« 2 h 14 min ») et ne change qu'une fois par minute.
   ============================================================ */

const pad = (n: number) => String(n).padStart(2, "0");

/** 8047 s → "02:14:07" (affichage à la seconde). */
export function formatCountdown(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
}

/** 8047 s → "2 h 14 min" (affichage à la minute, arrondi par défaut :
    on n'annonce jamais plus de temps qu'il n'en reste). */
export function formatCountdownMinutes(total: number): string {
  const s = Math.max(0, Math.floor(total));
  if (s < 60) return "moins d'une minute";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d} j ${h} h` : `${d} j`;
  if (h > 0) return m > 0 ? `${h} h ${pad(m)} min` : `${h} h`;
  return `${m} min`;
}

/** Marge après la bascule : un minuteur peut partir une milliseconde
    trop tôt, et la valeur affichée ne changerait pas. */
const MARGIN_MS = 25;

/** Délai (ms) avant que la valeur affichée change : fin de la seconde en
    cours, ou de la minute en cours si `byMinute`. */
export function nextCountdownDelay(
  remainingMs: number,
  byMinute: boolean,
): number {
  const unit = byMinute ? 60_000 : 1000;
  const left = Math.max(0, remainingMs);
  return (left % unit) + MARGIN_MS;
}
