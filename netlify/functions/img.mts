/* GET /api/img/:id — sert une photo d'annonce ou de profil depuis Blobs.

   Toute réponse interdit au navigateur de deviner le type (nosniff) et
   d'exécuter quoi que ce soit (CSP sandbox), et porte l'étiquette de
   cache `img-<id>` que media.mts purge quand une photo est retirée.
   Une photo de profil peut être masquée ou retirée : le navigateur la
   garde une heure au plus, le CDN jusqu'à la purge. */
import type { Config } from "@netlify/functions";
import { store, json } from "./_shared/core.mts";

const SAFE = {
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
};

export default async (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^i_[a-f0-9]{12}$/.test(id))
    return json({ error: "Image inconnue" }, 404, SAFE);
  const tagged = { ...SAFE, "netlify-cache-tag": `img-${id}` };
  const res = await store("imgs").getWithMetadata(id, { type: "arrayBuffer" });
  if (!res) return json({ error: "Image inconnue" }, 404, tagged);
  const cache: Record<string, string> =
    res.metadata?.kind === "avatar"
      ? {
          "cache-control": "public, max-age=3600",
          "netlify-cdn-cache-control": "public, max-age=31536000, immutable",
        }
      : { "cache-control": "public, max-age=31536000, immutable" };
  return new Response(res.data, {
    headers: {
      ...tagged,
      ...cache,
      "content-type": String(res.metadata?.contentType ?? "image/jpeg"),
    },
  });
};

export const config: Config = { path: "/api/img/:id" };
