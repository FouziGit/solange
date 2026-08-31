/* ============================================================
   SOLANGE — client API (Netlify Functions, même origine).
   Toutes les écritures passent ici ; le serveur revalide tout.
   ============================================================ */

import type { PushPrefs } from "./push-rules";

export type SessionUser = {
  id: string;
  email: string;
  handle: string;
  name: string;
};

export type ApiProduct = {
  id: string;
  brand: string;
  name: string;
  priceEUR: number;
  size: string;
  condition: string;
  category: string;
  description?: string;
  seed: string;
  seller: string;
  likes: number;
  images: string[];
  status: "available" | "sold";
  createdAt: number;
  mine?: boolean;
};

export type ApiOrder = {
  id: string;
  productId: string;
  brand: string;
  name: string;
  sellerHandle: string;
  sellerId?: string | null;
  buyerId?: string;
  buyerHandle?: string;
  priceEUR: number;
  protectionEUR: number;
  shippingEUR: number;
  totalEUR: number;
  shippingMethod?: string;
  shippingLabel?: string;
  /** Livraison à domicile uniquement — visible des deux parties de la commande. */
  address?: { name: string; line: string; postal: string; city: string };
  commissionRate?: number;
  commissionEUR?: number;
  netSellerEUR?: number;
  status: string;
  history?: {
    at: number;
    by: string;
    from: string;
    to: string;
    note?: string;
  }[];
  shipment?: { carrier?: string; tracking?: string; at: number };
  dispute?: { reason: string; note?: string; at: number };
  cancelReason?: string;
  /** Présent sur GET ?id= : mon rôle dans cette commande. */
  role?: "buyer" | "seller";
  simulated: boolean;
  createdAt: number;
};

export type ApiMessage = {
  id: string;
  fromId: string;
  text: string;
  at: number;
};

export type ApiConversation = {
  id: string;
  kind?: "item" | "dm";
  /** Posé quand une commande existe sur la pièce du fil (lot 1). */
  orderId?: string;
  buyerId: string;
  buyerHandle: string;
  sellerId: string | null;
  sellerHandle: string;
  productId: string;
  itemBrand: string;
  itemName: string;
  itemPriceEUR: number;
  messages: ApiMessage[];
  role: "buyer" | "seller";
  createdAt: number;
};

export type ApiPost = {
  id: string;
  authorHandle: string;
  authorName: string;
  caption: string;
  brandTags: string[];
  gallery: string[];
  createdAt: number;
};

export type SocialState = {
  liked: string[];
  saved: string[];
  follows: string[];
  joined: string[];
  blocked?: string[];
};

export type ApiNotif = {
  id: string;
  type: "sale" | "message" | "follow" | "report" | "order" | "circle";
  text: string;
  link: string;
  at: number;
  read: boolean;
};

export type PublicProfile = {
  user: { handle: string; name: string };
  dmOpen?: boolean;
  products: ApiProduct[];
  posts: ApiPost[];
};

/** Fil de Cercle tel que servi par /api/circles (likedBy reste privé). */
export type ApiThread = {
  id: string;
  circleId: string;
  authorId: string;
  authorHandle: string;
  authorName: string;
  title: string;
  text?: string;
  image?: string;
  createdAt: number;
  lastActivityAt: number;
  replyCount: number;
  likes: number;
  liked: boolean;
  pinned?: boolean;
};

export type ApiCircleReply = {
  id: string;
  authorId: string;
  authorHandle: string;
  text: string;
  at: number;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<
  { ok: true; data: T } | { ok: false; error: string; status: number }
> {
  try {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      ...init,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      return {
        ok: false,
        error: (data as { error?: string }).error ?? "Erreur réseau",
        status: res.status,
      };
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      error: "Hors ligne ou serveur indisponible",
      status: 0,
    };
  }
}

export const api = {
  me: () =>
    request<{
      user: SessionUser | null;
      social?: SocialState;
      orders?: ApiOrder[];
    }>("/api/me"),
  sendCode: (email: string) =>
    request<{ ok: boolean }>("/api/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verify: (email: string, code: string) =>
    request<{ ok: boolean; user: SessionUser }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  social: (
    kind: "liked" | "saved" | "follows" | "joined" | "blocked",
    id: string,
    on: boolean,
  ) =>
    request<{ ok: boolean }>("/api/social", {
      method: "POST",
      body: JSON.stringify({ kind, id, on }),
    }),
  products: () =>
    request<{
      products: ApiProduct[];
      soldSeeds: string[];
      likesMap: Record<string, number>;
    }>("/api/products"),
  createProduct: (p: {
    name: string;
    brand: string;
    category: string;
    condition: string;
    size: string;
    priceEUR: number;
    description?: string;
    images: string[];
  }) =>
    request<{ ok: boolean; product: ApiProduct }>("/api/products", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  order: (
    productId: string,
    shippingMethod?: string,
    relayLabel?: string,
    address?: { name: string; line: string; postal: string; city: string },
  ) =>
    request<{ ok: boolean; order: ApiOrder }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({ productId, shippingMethod, relayLabel, address }),
    }),
  orderById: (id: string) =>
    request<{ order: ApiOrder }>(`/api/orders?id=${encodeURIComponent(id)}`),
  orderTransition: (p: {
    id: string;
    action: "ship" | "cancel" | "receive" | "dispute";
    carrier?: string;
    tracking?: string;
    reason?: "non_recue" | "non_conforme";
    note?: string;
  }) =>
    request<{ ok: boolean; order: ApiOrder }>("/api/orders/transition", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  sales: () => request<{ orders: ApiOrder[] }>("/api/orders?sales=1"),
  myProducts: () => request<{ products: ApiProduct[] }>("/api/products?mine=1"),
  withdrawProduct: (id: string) =>
    request<{ ok: boolean }>(`/api/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  profile: (handle: string) =>
    request<PublicProfile>(`/api/profile/${encodeURIComponent(handle)}`),
  notifications: () =>
    request<{ notifications: ApiNotif[]; unread: number }>(
      "/api/notifications",
    ),
  markNotifsRead: () =>
    request<{ ok: boolean }>("/api/notifications", { method: "POST" }),
  report: (targetType: string, targetId: string, reason: string) =>
    request<{ ok: boolean }>("/api/report", {
      method: "POST",
      body: JSON.stringify({ targetType, targetId, reason }),
    }),
  deleteAccount: () =>
    request<{ ok: boolean }>("/api/account/delete", { method: "POST" }),
  getSettings: () => request<{ dmOpen: boolean }>("/api/settings"),
  saveSettings: (dmOpen: boolean) =>
    request<{ ok: boolean; dmOpen: boolean }>("/api/settings", {
      method: "POST",
      body: JSON.stringify({ dmOpen }),
    }),
  posts: () => request<{ posts: ApiPost[] }>("/api/posts"),
  createPost: (p: { caption: string; brandTags: string[]; images: string[] }) =>
    request<{ ok: boolean; post: ApiPost }>("/api/posts", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  /* — Notifications push (lot 3) — */
  pushConfig: () =>
    request<{
      enabled: boolean;
      publicKey: string | null;
      subscribed: boolean;
      devices?: number;
      prefs?: PushPrefs;
    }>("/api/push"),
  pushSubscribe: (subscription: unknown) =>
    request<{ ok: boolean; devices: number }>("/api/push", {
      method: "POST",
      body: JSON.stringify({ op: "subscribe", subscription }),
    }),
  pushUnsubscribe: (endpoint?: string) =>
    request<{ ok: boolean; devices: number }>("/api/push", {
      method: "POST",
      body: JSON.stringify({ op: "unsubscribe", endpoint }),
    }),
  pushPrefs: (prefs: PushPrefs) =>
    request<{ ok: boolean; prefs: PushPrefs }>("/api/push", {
      method: "POST",
      body: JSON.stringify({ op: "prefs", prefs }),
    }),
  pushTest: () =>
    request<{ ok: boolean }>("/api/push", {
      method: "POST",
      body: JSON.stringify({ op: "test" }),
    }),

  /* — Cercles (lot 2) — */
  circleThreads: (circleId: string) =>
    request<{ threads: ApiThread[]; lastSeenAt: number }>(
      `/api/circles?circle=${encodeURIComponent(circleId)}`,
    ),
  circleThread: (threadId: string) =>
    request<{ thread: ApiThread; replies: ApiCircleReply[] }>(
      `/api/circles?thread=${encodeURIComponent(threadId)}`,
    ),
  circlesUnread: () =>
    request<{ count: number; circleIds: string[] }>("/api/circles?unread=1"),
  circleSeen: (circleId: string) =>
    request<{ ok: boolean }>("/api/circles", {
      method: "POST",
      body: JSON.stringify({ op: "seen", circleId }),
    }),
  circleNewThread: (p: {
    circleId: string;
    title: string;
    text?: string;
    image?: string;
  }) =>
    request<{ ok: boolean; thread: ApiThread }>("/api/circles", {
      method: "POST",
      body: JSON.stringify({ op: "thread", ...p }),
    }),
  circleReply: (threadId: string, text: string) =>
    request<{ ok: boolean; reply: ApiCircleReply }>("/api/circles", {
      method: "POST",
      body: JSON.stringify({ op: "reply", threadId, text }),
    }),
  circleLike: (threadId: string) =>
    request<{ ok: boolean; liked: boolean; likes: number }>("/api/circles", {
      method: "POST",
      body: JSON.stringify({ op: "like", threadId }),
    }),
  circleDelete: (threadId: string, replyId?: string) =>
    request<{ ok: boolean }>("/api/circles", {
      method: "POST",
      body: JSON.stringify({ op: "delete", threadId, replyId }),
    }),
  conversations: () =>
    request<{ conversations: ApiConversation[] }>("/api/messages"),
  sendMessage: (p: {
    productId?: string;
    convId?: string;
    toHandle?: string;
    text: string;
  }) =>
    request<{ ok: boolean; conversation: ApiConversation }>("/api/messages", {
      method: "POST",
      body: JSON.stringify(p),
    }),
};

/** Redimensionne une photo côté client (mobile-first : upload léger). */
export function resizeImage(
  file: File,
  maxPx = 1280,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image illisible"));
    };
    img.src = url;
  });
}
