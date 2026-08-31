/* Pipeline média mutualisé (lot 2) — validation + stockage des photos
   uploadées en data URL, servi ensuite par /api/img/<id>. Extrait de
   posts.mts pour servir aussi les fils de Cercle (et la vidéo au lot 5).
   Retourne les chemins publics, ou une erreur de validation à afficher. */
import { newId, store } from "./core.mts";

const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMG_BYTES = 1_800_000;

export type StoreImagesResult =
  { ok: true; paths: string[] } | { ok: false; error: string };

export async function storeImages(
  dataUrls: unknown[],
  max: number,
): Promise<StoreImagesResult> {
  const imgs = store("imgs");
  const paths: string[] = [];
  for (const dataUrl of dataUrls.slice(0, max)) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
      String(dataUrl ?? ""),
    );
    if (!m || !IMG_TYPES.has(m[1]))
      return { ok: false, error: "Format de photo non supporté" };
    const buf = Buffer.from(m[2], "base64");
    if (buf.byteLength > MAX_IMG_BYTES)
      return { ok: false, error: "Photo trop lourde (max ~1,8 Mo)" };
    const iid = newId("i");
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
    await imgs.set(iid, ab, { metadata: { contentType: m[1] } });
    paths.push(`/api/img/${iid}`);
  }
  return { ok: true, paths };
}

/* ---------- vidéo (lot 5) ---------- */

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
/* Charge utile d'une Function : 6 Mo. Le base64 gonfle de 33 %, donc
   4 Mo de vidéo est le maximum réellement transmissible. */
const MAX_VIDEO_BYTES = 4_000_000;

export type StoreVideoResult =
  { ok: true; path: string } | { ok: false; error: string };

/** Stocke une vidéo envoyée en data URL. Revalide TOUT côté serveur : le
    contrôle fait dans le navigateur est un confort, jamais une garantie. */
export async function storeVideo(dataUrl: unknown): Promise<StoreVideoResult> {
  const m = /^data:(video\/(?:mp4|quicktime|webm));base64,(.+)$/.exec(
    String(dataUrl ?? ""),
  );
  if (!m || !VIDEO_TYPES.has(m[1]))
    return { ok: false, error: "Format vidéo non supporté (MP4 ou WebM)" };
  const buf = Buffer.from(m[2], "base64");
  if (buf.byteLength > MAX_VIDEO_BYTES)
    return { ok: false, error: "Vidéo trop lourde (4 Mo maximum)" };
  const vid = newId("v");
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  await store("vids").set(vid, ab, { metadata: { contentType: m[1] } });
  return { ok: true, path: `/api/vid/${vid}` };
}
