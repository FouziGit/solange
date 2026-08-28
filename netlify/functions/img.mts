/* GET /api/img/:id — sert une photo d'annonce depuis Blobs (cache immutable). */
import type { Config } from "@netlify/functions";
import { store, bad } from "./_shared/core.mts";

export default async (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^i_[a-f0-9]{12}$/.test(id)) return bad("Image inconnue", 404);
  const res = await store("imgs").getWithMetadata(id, { type: "arrayBuffer" });
  if (!res) return bad("Image inconnue", 404);
  return new Response(res.data, {
    headers: {
      "content-type": String(res.metadata?.contentType ?? "image/jpeg"),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = { path: "/api/img/:id" };
