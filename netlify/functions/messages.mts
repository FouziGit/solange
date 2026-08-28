/* /api/messages — conversations d'achat persistées.
   GET → mes conversations ; POST {productId?, convId?, text} → envoie un
   message (crée la conversation au premier message, rattachée au BON vendeur
   — fix du bug « mauvais vendeur » de l'audit). */
import type { Config } from "@netlify/functions";
import {
  store, json, bad, newId, currentUser, sameOrigin, readJson,
} from "./_shared/core.mts";
import { SEED_CATALOG } from "./_shared/seed-catalog.mts";

export default async (req: Request) => {
  const user = await currentUser(req);
  const msgs = store("msgs");

  if (req.method === "GET") {
    if (!user) return json({ conversations: [] });
    const ids = ((await msgs.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
    const conversations: unknown[] = [];
    for (const cid of ids.slice(-30).reverse()) {
      const c = await msgs.get(`c:${cid}`, { type: "json" });
      if (c) conversations.push(c);
    }
    return json({ conversations });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour envoyer un message", 401);

  const b = await readJson<{ productId?: string; convId?: string; text?: string }>(req);
  const text = (b?.text ?? "").trim().slice(0, 1000);
  if (!text) return bad("Message vide");

  let convId = (b?.convId ?? "").trim();
  let conv: Record<string, unknown> | null = null;

  if (convId) {
    conv = (await msgs.get(`c:${convId}`, { type: "json" })) as Record<string, unknown> | null;
    if (!conv || conv.buyerId !== user.id) return bad("Conversation inconnue", 404);
  } else {
    const pid = (b?.productId ?? "").trim();
    if (!pid) return bad("Article manquant");
    // Vendeur = celui de la fiche (annonce membre ou catalogue seed serveur)
    const record = (await store("products").get(`p:${pid}`, { type: "json" })) as
      | { brand: string; name: string; priceEUR: number; seller: string }
      | null;
    const item = record ?? SEED_CATALOG[pid];
    if (!item) return bad("Article inconnu", 404);

    convId = `${user.id}:${pid}`;
    conv = ((await msgs.get(`c:${convId}`, { type: "json" })) as Record<string, unknown> | null) ?? {
      id: convId,
      buyerId: user.id,
      sellerHandle: item.seller,
      productId: pid,
      itemBrand: item.brand,
      itemName: item.name,
      itemPriceEUR: item.priceEUR,
      messages: [],
      createdAt: Date.now(),
    };
    const mine = ((await msgs.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
    if (!mine.includes(convId)) { mine.push(convId); await msgs.setJSON(`u:${user.id}`, mine); }
  }

  const messages = (conv.messages as unknown[]) ?? [];
  if (messages.length > 500) return bad("Conversation pleine", 429);
  messages.push({ id: newId("m"), from: "me", text, at: Date.now() });
  conv.messages = messages;
  await msgs.setJSON(`c:${convId}`, conv);

  return json({ ok: true, conversation: conv });
};

export const config: Config = { path: "/api/messages" };
