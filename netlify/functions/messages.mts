/* /api/messages — conversations d'achat persistées, BILATÉRALES.
   GET  → mes conversations (comme acheteur ET comme vendeur)
   POST {productId?|convId?, text} → envoie un message ; crée la
   conversation au premier message, rattachée au vendeur réel de la pièce.
   Une annonce membre notifie son vendeur par email (throttle 1 h/conv). */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  currentUser,
  sameOrigin,
  readJson,
  sendEmail,
  userEmail,
  APP_URL,
  pushNotif,
  rateLimit,
} from "./_shared/core.mts";
import { SEED_CATALOG } from "./_shared/seed-catalog.mts";

type Conv = {
  id: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string | null; // null = vendeur seed (fictif)
  sellerHandle: string;
  productId: string;
  itemBrand: string;
  itemName: string;
  itemPriceEUR: number;
  messages: { id: string; fromId: string; text: string; at: number }[];
  lastEmailAt?: number;
  createdAt: number;
};

async function pushIndex(uid: string, convId: string) {
  const msgs = store("msgs");
  const list =
    ((await msgs.get(`u:${uid}`, { type: "json" })) as string[]) ?? [];
  if (!list.includes(convId)) {
    list.push(convId);
    await msgs.setJSON(`u:${uid}`, list);
  }
}

export default async (req: Request) => {
  const user = await currentUser(req);
  const msgs = store("msgs");

  if (req.method === "GET") {
    if (!user) return json({ conversations: [] });
    const ids =
      ((await msgs.get(`u:${user.id}`, { type: "json" })) as string[]) ?? [];
    const conversations: unknown[] = [];
    for (const cid of ids.slice(-30).reverse()) {
      const c = (await msgs.get(`c:${cid}`, { type: "json" })) as Conv | null;
      if (c)
        conversations.push({
          ...c,
          role: c.buyerId === user.id ? "buyer" : "seller",
        });
    }
    return json({ conversations });
  }

  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  if (!user) return bad("Connecte-toi pour envoyer un message", 401);

  const b = await readJson<{
    productId?: string;
    convId?: string;
    text?: string;
  }>(req);
  const text = (b?.text ?? "").trim().slice(0, 1000);
  if (!text) return bad("Message vide");
  if (!(await rateLimit(`msg:${user.id}`, 60, 3_600_000)))
    return bad("Trop de messages — réessaie dans une heure", 429);

  let convId = (b?.convId ?? "").trim();
  let conv: Conv | null = null;

  if (convId) {
    conv = (await msgs.get(`c:${convId}`, { type: "json" })) as Conv | null;
    if (!conv || (conv.buyerId !== user.id && conv.sellerId !== user.id))
      return bad("Conversation inconnue", 404);
  } else {
    const pid = (b?.productId ?? "").trim();
    if (!pid) return bad("Article manquant");
    // Vendeur = celui de la fiche (annonce membre ou catalogue seed serveur)
    const record = (await store("products").get(`p:${pid}`, {
      type: "json",
    })) as {
      brand: string;
      name: string;
      priceEUR: number;
      seller: string;
      sellerId?: string;
    } | null;
    const item = record ?? SEED_CATALOG[pid];
    if (!item) return bad("Article inconnu", 404);
    const sellerId = record?.sellerId ?? null;
    if (sellerId === user.id) return bad("C'est ta propre annonce", 403);

    convId = `${user.id}:${pid}`;
    conv = ((await msgs.get(`c:${convId}`, {
      type: "json",
    })) as Conv | null) ?? {
      id: convId,
      buyerId: user.id,
      buyerHandle: user.handle,
      sellerId,
      sellerHandle: item.seller,
      productId: pid,
      itemBrand: item.brand,
      itemName: item.name,
      itemPriceEUR: item.priceEUR,
      messages: [],
      createdAt: Date.now(),
    };
    await pushIndex(user.id, convId);
    if (sellerId) await pushIndex(sellerId, convId);
  }

  if (conv.messages.length > 500) return bad("Conversation pleine", 429);
  conv.messages.push({ id: newId("m"), fromId: user.id, text, at: Date.now() });

  // Notifie l'autre participant réel par email, au plus 1 fois par heure.
  const recipientId = user.id === conv.buyerId ? conv.sellerId : conv.buyerId;
  if (recipientId)
    await pushNotif(recipientId, {
      type: "message",
      text: `@${user.handle} · ${conv.itemBrand} ${conv.itemName}`,
      link: "/messages",
    });
  if (recipientId && Date.now() - (conv.lastEmailAt ?? 0) > 3_600_000) {
    const to = await userEmail(recipientId);
    if (to) {
      conv.lastEmailAt = Date.now();
      await sendEmail(
        to,
        `Nouveau message — ${conv.itemBrand} ${conv.itemName}`,
        `<p style="font-size:15px;margin:0 0 14px">@${user.handle} t'a écrit à propos de
           <strong>${conv.itemBrand} — ${conv.itemName}</strong> :</p>
         <p style="font-size:14px;color:#b8b3a8;border-left:2px solid #3a3a3c;padding-left:12px;margin:0 0 20px">${text
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")}</p>
         <p style="margin:0"><a href="${APP_URL}/messages" style="color:#f4f1ea">Répondre dans l'app →</a></p>`,
      );
    }
  }

  await msgs.setJSON(`c:${convId}`, conv);
  return json({
    ok: true,
    conversation: {
      ...conv,
      role: conv.buyerId === user.id ? "buyer" : "seller",
    },
  });
};

export const config: Config = { path: "/api/messages" };
