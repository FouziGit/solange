/* ============================================================
   SOLANGE — vidéos des membres (lot 5). Règles PURES de validation
   et de service, partagées client (refus immédiat, message clair)
   et serveur (revalidation — le client ne décide jamais).
   Testées dans src/lib/__tests__/video.test.ts.
   ============================================================ */

/** H.264 d'abord : le seul codec lu partout, iOS compris. */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const MAX_VIDEO_BYTES = 4_000_000; // charge Netlify 6 Mo − 33 % de base64
export const MAX_VIDEO_SECONDS = 15;

export type VideoCheck =
  | { ok: true }
  | { ok: false; reason: "type" | "size" | "duration"; message: string };

const mo = (bytes: number) =>
  `${(bytes / 1_000_000).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })} Mo`;

/**
 * Un fichier est-il publiable ? On refuse avec le CHIFFRE exact plutôt
 * qu'un « fichier invalide » : la personne doit savoir quoi corriger.
 * `durationSec` est absent tant que le navigateur n'a pas lu les métadonnées.
 */
export function checkVideo(
  file: { type: string; size: number },
  durationSec?: number,
): VideoCheck {
  if (!VIDEO_TYPES.includes(file.type))
    return {
      ok: false,
      reason: "type",
      message: "Format non lu — envoie un MP4 (H.264) ou un WebM.",
    };
  if (file.size > MAX_VIDEO_BYTES)
    return {
      ok: false,
      reason: "size",
      message: `Vidéo trop lourde (${mo(file.size)} — ${mo(
        MAX_VIDEO_BYTES,
      )} maximum). Raccourcis-la ou baisse la qualité.`,
    };
  if (durationSec !== undefined && durationSec > MAX_VIDEO_SECONDS)
    return {
      ok: false,
      reason: "duration",
      message: `Vidéo trop longue (${Math.round(
        durationSec,
      )} s — ${MAX_VIDEO_SECONDS} s maximum).`,
    };
  return { ok: true };
}

/* ---------- service : requêtes partielles (RFC 7233) ---------- */

export type RangeSpec = { start: number; end: number; length: number };

/**
 * Interprète un en-tête `Range: bytes=…` sur un fichier de `size` octets.
 * `null` = pas de plage demandée (on sert tout). `"invalid"` = plage hors
 * limites → 416, comme l'exige la spec.
 *
 * Safari commence TOUJOURS par demander `bytes=0-1` : sans cette
 * fonction, aucune vidéo ne se lit sur iPhone.
 */
export function parseRange(
  header: string | null,
  size: number,
): RangeSpec | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return "invalid";

  let start: number;
  let end: number;
  if (rawStart === "") {
    // suffixe : les N derniers octets
    const n = Number(rawEnd);
    if (n <= 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start > end || start >= size) return "invalid";
  end = Math.min(end, size - 1);
  return { start, end, length: end - start + 1 };
}
