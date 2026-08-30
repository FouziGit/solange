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
