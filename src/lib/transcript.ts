/* ============================================================
   SOLANGE — transcription des vidéos membres (WCAG 1.2).
   « Ce que tu dis dans la vidéo », en texte : pour les personnes
   sourdes ou malentendantes, et pour qui regarde sans le son.
   Règle PURE, partagée client (limite du champ) et serveur
   (revalidation dans netlify/functions/posts.mts).
   Testée dans src/lib/__tests__/transcript.test.ts.
   ============================================================ */

export const TRANSCRIPT_MAX = 2000;

export type TranscriptCheck =
  { ok: true; value?: string } | { ok: false; message: string };

const nombre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Nettoie la transcription reçue : facultative (absente ou vide → pas de
 * champ), espaces de bord retirés, refusée au-delà de TRANSCRIPT_MAX
 * caractères avec le chiffre exact plutôt que coupée en silence.
 */
export function cleanTranscript(raw: unknown): TranscriptCheck {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "string")
    return { ok: false, message: "Transcription illisible." };
  const value = raw.trim();
  if (!value) return { ok: true };
  if (value.length > TRANSCRIPT_MAX)
    return {
      ok: false,
      message: `Transcription trop longue (${nombre(
        value.length,
      )} caractères — ${nombre(TRANSCRIPT_MAX)} maximum).`,
    };
  return { ok: true, value };
}
