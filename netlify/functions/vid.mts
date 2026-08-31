/* GET /api/vid/:id — sert une vidéo membre depuis Blobs (lot 5).
   Implémente les requêtes partielles (RFC 7233) : SANS ça, Safari refuse
   de lire — il commence par demander `bytes=0-1`. La fonctionnalité
   serait morte sur iPhone. */
import type { Config } from "@netlify/functions";
import { store, bad } from "./_shared/core.mts";
import { parseRange } from "../../src/lib/video.ts";

export default async (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^v_[a-f0-9]{12}$/.test(id)) return bad("Vidéo inconnue", 404);

  const res = await store("vids").getWithMetadata(id, {
    type: "arrayBuffer",
  });
  if (!res) return bad("Vidéo inconnue", 404);

  const buf = res.data as ArrayBuffer;
  const size = buf.byteLength;
  const contentType = String(res.metadata?.contentType ?? "video/mp4");
  const common = {
    "content-type": contentType,
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
  };

  const range = parseRange(req.headers.get("range"), size);

  if (range === "invalid")
    return new Response(null, {
      status: 416,
      headers: { ...common, "content-range": `bytes */${size}` },
    });

  if (range === null)
    return new Response(buf, {
      headers: { ...common, "content-length": String(size) },
    });

  return new Response(buf.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      ...common,
      "content-length": String(range.length),
      "content-range": `bytes ${range.start}-${range.end}/${size}`,
    },
  });
};

export const config: Config = { path: "/api/vid/:id" };
