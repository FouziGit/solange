/* /api/products
   GET  → liste des annonces créées par les membres (CatalogItem-compatible)
   POST → crée une annonce (auth requise) : photos base64 → Blobs, champs validés.
   Corrige l'impasse /vendre de l'audit : l'annonce EXISTE désormais. */
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

const CATEGORIES = [
  "Femme",
  "Homme",
  "Streetwear",
  "Luxe",
  "Archive",
  "Sneakers",
  "Accessoires",
];
const CONDITIONS = [
  "Neuf avec étiquette",
  "Excellent état",
  "Très bon état",
  "Bon état",
];
const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMG_BYTES = 1_800_000;

type CreateBody = {
  name?: string;
  brand?: string;
  category?: string;
  condition?: string;
  size?: string;
  priceEUR?: number;
  description?: string;
  images?: string[];
};

export default async (req: Request) => {
  const products = store("products");

  if (req.method === "GET") {
    const idx =
      ((await products.get("idx", { type: "json" })) as string[]) ?? [];
    const me = await currentUser(req);
    const mineOnly = new URL(req.url).searchParams.get("mine") === "1";
    if (mineOnly && !me) return json({ products: [], soldSeeds: [] });
    const out: unknown[] = [];
    for (const id of idx.slice(-60).reverse()) {
      const p = (await products.get(`p:${id}`, { type: "json" })) as Record<
        string,
        unknown
      > | null;
      if (!p || p.shadow) continue; // shadows = seeds vendus, exposés via /api/sold
      const mine = me ? p.sellerId === me.id : false;
      if (mineOnly && !mine) continue;
      if (!mineOnly && p.status === "withdrawn") continue; // retirée = invisible au public
      // lot 4 : masquée par la modération — invisible au public, mais son
      // auteur la voit encore (il doit comprendre ce qui lui arrive)
      if (!mine && p.hidden) continue;
      out.push({ ...p, mine });
    }
    // état vendu des pièces seed (shadows) pour griser le catalogue côté UI
    const soldSeeds =
      ((await products.get("sold-seeds", { type: "json" })) as string[]) ?? [];
    const likesMap =
      ((await store("counters").get("likes", { type: "json" })) as Record<
        string,
        number
      >) ?? {};
    return json({ products: out, soldSeeds, likesMap });
  }

  if (req.method === "DELETE") {
    // Retrait d'annonce par son vendeur (soft : status withdrawn, la pièce
    // reste dans l'historique des commandes déjà passées).
    if (!sameOrigin(req)) return bad("Origine refusée", 403);
    const me = await currentUser(req);
    if (!me) return bad("Connexion requise", 401);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const p = (await products.get(`p:${id}`, { type: "json" })) as {
      sellerId?: string;
      status?: string;
    } | null;
    if (!p || p.sellerId !== me.id) return bad("Annonce inconnue", 404);
    if (p.status === "sold")
      return bad("Déjà vendue — impossible de retirer", 409);
    await products.setJSON(`p:${id}`, {
      ...p,
      status: "withdrawn",
      withdrawnAt: Date.now(),
    });
    return json({ ok: true });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connecte-toi pour déposer une annonce", 401);
  // lot 4 : un membre suspendu lit tout mais ne publie rien
  const blocked = await assertCanWrite(user);
  if (blocked) return blocked;

  if (!(await rateLimit(`prod:${user.id}`, 10, 24 * 3_600_000)))
    return bad("Limite de 10 annonces par jour atteinte", 429);
  const b = await readJson<CreateBody>(req);
  if (!b) return bad("Corps invalide");
  const name = (b.name ?? "").trim().slice(0, 80);
  const brand = (b.brand ?? "").trim().slice(0, 40);
  const size = (b.size ?? "").trim().slice(0, 12);
  const description = (b.description ?? "").trim().slice(0, 600);
  const priceEUR = Math.round(Number(b.priceEUR));
  if (!name || !brand || !size)
    return bad("Titre, marque et taille sont requis");
  if (!Number.isFinite(priceEUR) || priceEUR < 1 || priceEUR > 20000)
    return bad("Prix invalide (1 à 20 000 €)");
  if (!CATEGORIES.includes(b.category ?? "")) return bad("Catégorie invalide");
  if (!CONDITIONS.includes(b.condition ?? "")) return bad("État invalide");

  // photos : dataURL → Blobs (max 4, types sûrs, taille bornée)
  const imgs = store("imgs");
  const imageIds: string[] = [];
  for (const dataUrl of (b.images ?? []).slice(0, 4)) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
      dataUrl ?? "",
    );
    if (!m || !IMG_TYPES.has(m[1])) return bad("Format de photo non supporté");
    const buf = Buffer.from(m[2], "base64");
    if (buf.byteLength > MAX_IMG_BYTES)
      return bad("Photo trop lourde (max ~1,8 Mo)");
    const iid = newId("i");
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
    await imgs.set(iid, ab, { metadata: { contentType: m[1] } });
    imageIds.push(iid);
  }

  const id = newId("p");
  const product = {
    id,
    brand,
    name,
    priceEUR,
    size,
    condition: b.condition,
    category: b.category,
    description,
    seed: `api-${id}`,
    seller: user.handle,
    sellerId: user.id,
    likes: 0,
    images: imageIds.map((iid) => `/api/img/${iid}`),
    status: "available",
    createdAt: Date.now(),
  };
  await products.setJSON(`p:${id}`, product);
  const idx = ((await products.get("idx", { type: "json" })) as string[]) ?? [];
  idx.push(id); // NOTE beta : append non transactionnel (perte possible sous forte concurrence)
  await products.setJSON("idx", idx);

  return json({ ok: true, product });
};

export const config: Config = { path: "/api/products" };
