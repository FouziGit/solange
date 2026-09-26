/* Pipeline média mutualisé (lot 2) — validation + stockage des photos
   uploadées en data URL, servi ensuite par /api/img/<id>. Extrait de
   posts.mts pour servir aussi les fils de Cercle (et la vidéo au lot 5).
   Retourne les chemins publics, ou une erreur de validation à afficher. */
import { purgeCache } from "@netlify/functions";
import {
  AVATAR_MAX_BYTES,
  imgIdFromPath,
  isJpeg,
  sanitizeJpeg,
} from "../../../src/lib/avatar.ts";
import { newId, store } from "./core.mts";

const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMG_BYTES = 1_800_000;

export type StoreImagesResult =
  { ok: true; paths: string[] } | { ok: false; error: string };

/** Écrit une image dans `imgs` et rend son chemin public. */
async function putImage(
  bytes: Uint8Array,
  metadata: Record<string, string>,
): Promise<string> {
  const iid = newId("i");
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  await store("imgs").set(iid, ab, { metadata });
  return `/api/img/${iid}`;
}

export async function storeImages(
  dataUrls: unknown[],
  max: number,
): Promise<StoreImagesResult> {
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
    paths.push(await putImage(buf, { contentType: m[1] }));
  }
  return { ok: true, paths };
}

/* ---------- photo de profil ---------- */

/** Photo de profil : un JPEG déjà recadré par le navigateur. Le serveur
    n'en garde que ce qui sert à l'afficher (sanitizeJpeg) : EXIF, GPS,
    commentaires et octets accolés disparaissent avant stockage. */
export async function storeAvatar(
  dataUrl: unknown,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const unsupported = {
    ok: false,
    message: "Format de photo non supporté.",
  } as const;
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(
    typeof dataUrl === "string" ? dataUrl : "",
  );
  if (!m) return unsupported;
  const buf = Buffer.from(m[1], "base64");
  if (buf.byteLength > AVATAR_MAX_BYTES)
    return { ok: false, message: "Photo trop lourde." };
  if (!isJpeg(buf)) return unsupported;
  const clean = sanitizeJpeg(buf);
  if (!clean) return unsupported;
  const path = await putImage(clean.bytes, {
    contentType: "image/jpeg",
    kind: "avatar",
  });
  return { ok: true, path };
}

/** Vide le cache CDN d'une image retirée du public (en-tête
    netlify-cache-tag posé par img.mts). Au mieux : le cache du CDN expire
    de toute façon, et un échec ne doit pas bloquer le retrait. */
async function purgeImage(id: string): Promise<void> {
  try {
    await purgeCache({ tags: [`img-${id}`] });
  } catch {
    console.error("img_purge_error");
  }
}

/** Efface une image (publique ou en quarantaine) et son cache CDN.
    Silencieuse : n'agit que sur un chemin `/api/img/i_<12hex>`. */
export async function deleteImage(path: unknown): Promise<void> {
  const id = imgIdFromPath(path);
  if (!id) return;
  try {
    await Promise.all([store("imgs").delete(id), store("imgs-q").delete(id)]);
  } catch {
    console.error("img_delete_error");
  }
  await purgeImage(id);
}

/** Déplace une image d'un store à l'autre, métadonnées comprises. Déjà
    à destination (second appel) : c'est un succès. */
async function moveImage(
  id: string,
  from: string,
  to: string,
): Promise<boolean> {
  const src = store(from);
  const dst = store(to);
  const res = await src.getWithMetadata(id, { type: "arrayBuffer" });
  if (!res) return (await dst.getMetadata(id)) !== null;
  await dst.set(id, res.data, { metadata: res.metadata });
  await src.delete(id);
  return true;
}

/** Photo masquée : sort de `imgs` (donc de /api/img) vers `imgs-q`. */
export async function quarantineImage(path: unknown): Promise<boolean> {
  const id = imgIdFromPath(path);
  if (!id) return false;
  try {
    const moved = await moveImage(id, "imgs", "imgs-q");
    await purgeImage(id);
    return moved;
  } catch {
    console.error("img_quarantine_error");
    return false;
  }
}

/** Photo rétablie : revient de `imgs-q` vers `imgs`. */
export async function restoreImage(path: unknown): Promise<boolean> {
  const id = imgIdFromPath(path);
  if (!id) return false;
  try {
    return await moveImage(id, "imgs-q", "imgs");
  } catch {
    console.error("img_restore_error");
    return false;
  }
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
