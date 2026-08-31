/* /api/posts — publications membres du feed (/creer).
   GET → derniers posts ; POST → crée un post (auth requise).
   Corrige l'impasse /creer de l'audit : le post apparaît dans le feed. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  assertCanWrite,
  currentUser,
  sameOrigin,
  readJson,
  rateLimit,
} from "./_shared/core.mts";
import { storeImages, storeVideo } from "./_shared/media.mts";

export default async (req: Request) => {
  const posts = store("posts");

  if (req.method === "GET") {
    const idx = ((await posts.get("idx", { type: "json" })) as string[]) ?? [];
    const out: unknown[] = [];
    for (const id of idx.slice(-30).reverse()) {
      const p = (await posts.get(`l:${id}`, { type: "json" })) as {
        hidden?: boolean;
      } | null;
      // lot 4 : un contenu masqué par la modération sort des lectures publiques
      if (p && !p.hidden) out.push(p);
    }
    return json({ posts: out });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connecte-toi pour publier", 401);
  // lot 4 : un membre suspendu lit tout mais ne publie rien
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;

  const b = await readJson<{
    caption?: string;
    brandTags?: string[];
    images?: string[];
    video?: string;
    poster?: string;
    productIds?: string[];
  }>(req);
  if (!(await rateLimit(`post:${user.id}`, 10, 24 * 3_600_000)))
    return bad("Limite de 10 publications par jour atteinte", 429);
  const caption = (b?.caption ?? "").trim().slice(0, 500);
  if (!caption) return bad("Écris une légende");
  const brandTags = (b?.brandTags ?? [])
    .slice(0, 5)
    .map((t) => String(t).slice(0, 30));

  // pipeline média mutualisé (lot 2) — même validation pour posts et Cercles
  const stored = await storeImages(b?.images ?? [], 4);
  if (!stored.ok) return bad(stored.error);
  const gallery = stored.paths;

  /* Vidéo (lot 5) — derrière un drapeau. Le contrôle fait dans le
     navigateur est un confort : storeVideo revalide tout. L'image
     d'attente est générée côté client (aucun transcodage disponible,
     D-028) et voyage comme une photo ordinaire. */
  let video: string | undefined;
  let poster: string | undefined;
  if (b?.video) {
    if (process.env.NEXT_PUBLIC_VIDEO_UPLOAD !== "1")
      return bad("Publication vidéo pas encore ouverte", 503);
    const v = await storeVideo(b.video);
    if (!v.ok) return bad(v.error);
    video = v.path;
    if (b.poster) {
      const p = await storeImages([b.poster], 1);
      if (p.ok) poster = p.paths[0];
    }
  }

  /* Pièces taguées : « Shop the look » sur une publication membre comme
     sur un look éditorial. On ne garde que des identifiants plausibles. */
  const productIds = (b?.productIds ?? [])
    .slice(0, 6)
    .map((x) => String(x).slice(0, 40))
    .filter(Boolean);

  const id = newId("l");
  const post = {
    id,
    authorId: user.id,
    authorHandle: user.handle,
    authorName: user.name,
    caption,
    brandTags,
    gallery,
    video,
    poster,
    productIds,
    createdAt: Date.now(),
  };
  await posts.setJSON(`l:${id}`, post);
  const idx = ((await posts.get("idx", { type: "json" })) as string[]) ?? [];
  idx.push(id);
  await posts.setJSON("idx", idx);

  return json({ ok: true, post });
};

export const config: Config = { path: "/api/posts" };
