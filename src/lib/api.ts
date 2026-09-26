/* ============================================================
   SOLANGE — client API (Netlify Functions, même origine).
   Toutes les écritures passent ici ; le serveur revalide tout.
   ============================================================ */

import type { PushPrefs } from "./push-rules";
import type { LegalConsent } from "./legal-consent";
import { AVATAR_QUALITY, squareCropRect } from "./avatar";
import { normalizeHandle } from "./handle";
import type { PublicMember } from "./members";

export type { PublicMember } from "./members";

export type SessionUser = {
  id: string;
  email: string;
  handle: string;
  name: string;
  /** Preuve d'acceptation des conditions. `null` sur les comptes créés
      avant sa mise en place : ils passent par l'écran de réacceptation. */
  legal?: LegalConsent | null;
  /** `/api/img/i_…`, ou null : pas de photo, ou photo masquée par la
      modération. */
  avatar?: string | null;
  /** Une photo masquée par la modération est encore gardée : le membre
      peut la retirer. */
  avatarHidden?: boolean;
  /** Photo masquée par la modération : pas de nouvelle photo possible. */
  avatarLocked?: boolean;
  /** Dernier changement d'@identifiant (ms). null : jamais changé. */
  handleChangedAt?: number | null;
  nextHandleChangeAt?: number | null;
  /** Anciens identifiants du membre, qu'il peut reprendre. Vus par lui
      seul (/api/me et connexion). */
  formerHandles?: string[];
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
  sellerId?: string | null;
  sellerAvatar?: string | null;
  likes: number;
  images: string[];
  /* `reserved` : quelqu'un est en train de payer la pièce (30 minutes au
     plus). Elle n'est plus achetable, mais pas encore vendue. */
  status: "available" | "sold" | "reserved" | "withdrawn";
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
  buyerAvatar?: string | null;
  sellerId: string | null;
  sellerHandle: string;
  sellerAvatar?: string | null;
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
  authorId?: string;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string | null;
  caption: string;
  brandTags: string[];
  gallery: string[];
  /** Lot 5 : vidéo membre (+ son image d'attente) et pièces taguées. */
  video?: string;
  poster?: string;
  /** Transcription de la vidéo : ce qui s'y dit, en texte (WCAG 1.2). */
  transcript?: string;
  productIds?: string[];
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
  user: { id?: string; handle: string; name: string; avatar?: string | null };
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
  authorAvatar?: string | null;
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
  authorName?: string;
  authorAvatar?: string | null;
  text: string;
  at: number;
};

/** File de modération (lot 4) — réservée aux admins. */
export type ModReportItem = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  reporterHandle: string;
  status: "open" | "done";
  at: number;
  resolvedBy?: string;
  resolvedAt?: number;
  action?: string;
  context: {
    label: string;
    excerpt?: string;
    image?: string;
    authorId?: string;
    authorHandle?: string;
    hidden?: boolean;
    link?: string;
  } | null;
  priorReports: number;
};

export type ModDispute = {
  id: string;
  brand: string;
  name: string;
  buyerHandle: string;
  sellerHandle: string;
  totalEUR: number;
  dispute?: { reason: string; note?: string; at: number };
  createdAt: number;
};

export type ModAuditEntry = {
  id: string;
  at: number;
  adminHandle: string;
  action: string;
  targetType: string;
  targetId: string;
  note?: string;
};

/** Échec d'un appel. `code` : raison lisible par l'écran (`taken`,
    `cooldown`…) ; `body` : la réponse entière (ex. `nextHandleChangeAt`). */
export type ApiError = {
  ok: false;
  error: string;
  status: number;
  code?: string;
  body?: unknown;
};
export type ApiResult<T> = { ok: true; data: T } | ApiError;

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      ...init,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = (data as { code?: unknown } | null)?.code;
      return {
        ok: false,
        error: (data as { error?: string }).error ?? "Erreur réseau",
        status: res.status,
        code: typeof code === "string" ? code : undefined,
        body: data,
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      error: "Hors ligne ou serveur indisponible",
      status: 0,
    };
  }
}

/** Le serveur lit 50 handles au plus par requête. */
export const MEMBERS_BATCH = 50;

/** Handles normalisés (comme le serveur les lit), sans doublon, en lots
    de `size`. Une saisie qui ne peut pas être un handle ne part pas. */
export function memberBatches(
  handles: string[],
  size = MEMBERS_BATCH,
): string[][] {
  const unique = [
    ...new Set(
      handles.map(normalizeHandle).filter((h) => /^[a-z0-9._-]{1,30}$/.test(h)),
    ),
  ];
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size)
    out.push(unique.slice(i, i + size));
  return out;
}

/** Membres par handle, clés normalisées (normalizeHandle). Un handle
    inconnu, supprimé ou ancien sans renvoi est absent. Un lot en échec
    fait échouer l'ensemble : « introuvable » et « hors ligne » ne se
    confondent pas. */
async function fetchMembers(
  handles: string[],
): Promise<ApiResult<{ members: Record<string, PublicMember> }>> {
  const results = await Promise.all(
    memberBatches(handles).map((batch) =>
      request<{ members: Record<string, PublicMember> }>(
        `/api/members?handles=${encodeURIComponent(batch.join(","))}`,
      ),
    ),
  );
  /* Sans prototype : un membre nommé « constructor » ou « __proto__ » est
     une clé comme une autre, et un handle absent reste absent. */
  const members = Object.create(null) as Record<string, PublicMember>;
  for (const r of results) {
    if (!r.ok) return r;
    for (const [h, m] of Object.entries(r.data.members ?? {})) members[h] = m;
  }
  return { ok: true, data: { members } };
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
  /* Les deux booléens sont OBLIGATOIRES côté serveur : sans eux, pas de
     compte. Ils correspondent à deux cases distinctes, non pré-cochées. */
  verify: (
    email: string,
    code: string,
    consent: { acceptLegal: boolean; ageDeclared: boolean },
  ) =>
    request<{ ok: boolean; user: SessionUser }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, ...consent }),
    }),
  acceptLegal: () =>
    request<{ ok: boolean; legal: LegalConsent }>("/api/legal/accept", {
      method: "POST",
      body: JSON.stringify({ acceptLegal: true, ageDeclared: true }),
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
  /* acceptCgv : acceptation des CGV pour CETTE vente, exigée par le
     serveur. Elle est horodatée sur la commande, ce qui la garde
     opposable même si les CGV changent après coup. */
  order: (
    productId: string,
    shippingMethod?: string,
    relayLabel?: string,
    address?: { name: string; line: string; postal: string; city: string },
    acceptCgv = false,
  ) =>
    request<{ ok: boolean; order: ApiOrder; checkoutUrl?: string | null }>(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({
          productId,
          shippingMethod,
          relayLabel,
          address,
          acceptCgv,
        }),
      },
    ),
  /* ---- paiement réel (Stripe Connect) ---- */
  /** Le paiement est-il réel ? Sans clé Stripe posée : non, et tout le
      parcours reste en démonstration. */
  paymentsConfig: () =>
    request<{ live: boolean; test: boolean }>("/api/payments/config"),
  /** État du compte de paiement du vendeur connecté. */
  sellerPayments: () =>
    request<{
      enabled: boolean;
      status?: "absent" | "incomplet" | "verification" | "actif";
      payable?: boolean;
    }>("/api/stripe/connect"),
  /** Lien d'inscription Stripe (identité, IBAN) — à usage unique. */
  startSellerPayments: () =>
    request<{ enabled: boolean; url?: string }>("/api/stripe/connect", {
      method: "POST",
    }),
  /** Une annonce membre, pour la page de paiement. */
  product: (id: string) =>
    request<{ product: ApiProduct }>(
      `/api/products?id=${encodeURIComponent(id)}`,
    ),
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
  /* — Profil : @identifiant et photo — */
  /** Refus : `code` vaut invalid, same, blocked, taken, cooldown (avec
      `nextHandleChangeAt` dans `body`), pending, conflict ou rate. */
  changeHandle: (handle: string, redirect: boolean) =>
    request<{
      ok: boolean;
      handle: string;
      handleChangedAt: number;
      nextHandleChangeAt: number;
    }>("/api/me/handle", {
      method: "POST",
      body: JSON.stringify({ handle, redirect }),
    }),
  /** `image` : data URL JPEG, préparée par prepareAvatar(). */
  setAvatar: (image: string) =>
    request<{ ok: boolean; avatar: string }>("/api/me/avatar", {
      method: "POST",
      body: JSON.stringify({ image }),
    }),
  removeAvatar: () =>
    request<{ ok: boolean; avatar: null }>("/api/me/avatar", {
      method: "DELETE",
    }),
  members: (handles: string[]) => fetchMembers(handles),
  posts: () => request<{ posts: ApiPost[] }>("/api/posts"),
  createPost: (p: {
    caption: string;
    brandTags: string[];
    images: string[];
    video?: string;
    poster?: string;
    transcript?: string;
    productIds?: string[];
  }) =>
    request<{ ok: boolean; post: ApiPost }>("/api/posts", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  /* — Modération (lot 4, admins) — */
  modQueue: (queue: "open" | "done" | "all" = "open") =>
    request<{ items: ModReportItem[]; disputes: ModDispute[] }>(
      `/api/admin?queue=${queue}`,
    ),
  modAudit: () => request<{ audit: ModAuditEntry[] }>("/api/admin?audit=1"),
  modAct: (p: {
    reportId: string;
    /* Les trois « un- » lèvent une mesure : la charte de modération les
       annonce (« la mesure est levée et ses effets effacés »), elles
       n'existaient nulle part. */
    action:
      | "dismiss"
      | "warn"
      | "hide"
      | "suspend"
      | "ban"
      | "unhide"
      | "unsuspend"
      | "unban";
    authorId?: string;
    days?: number;
    note?: string;
  }) =>
    request<{ ok: boolean; applied: boolean }>("/api/admin", {
      method: "POST",
      body: JSON.stringify({ op: "act", ...p }),
    }),
  modDispute: (
    orderId: string,
    decision: "cancel" | "close" | "return",
    note?: string,
  ) =>
    request<{ ok: boolean }>("/api/admin", {
      method: "POST",
      body: JSON.stringify({ op: "dispute", orderId, decision, note }),
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

/** Photo de profil : carré centré de 512 px au plus, en JPEG. Le fond
    crème remplace la transparence d'un PNG, que le JPEG rendrait noire.
    Le serveur retire ensuite les métadonnées (EXIF, position). */
export function prepareAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const fail = (why: string) => {
      URL.revokeObjectURL(url);
      reject(new Error(why));
    };
    const img = new Image();
    img.onload = () => {
      const { sx, sy, side, out } = squareCropRect(
        img.naturalWidth,
        img.naturalHeight,
      );
      if (out < 1) return fail("image vide");
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("canvas");
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(0, 0, out, out);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
    };
    img.onerror = () => fail("image illisible");
    img.src = url;
  });
}

/**
 * Extrait l'image d'attente d'une vidéo, dans le navigateur (lot 5).
 * Aucun transcodage n'existe côté serveur (D-028) : on cherche la
 * première image utile, on la dessine sur un canvas, on renvoie un JPEG.
 * Renvoie aussi la durée, que le serveur ne saurait pas mesurer.
 */
export function videoPoster(
  file: File,
): Promise<{ poster: string; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;

    const fail = (why: string) => {
      URL.revokeObjectURL(url);
      reject(new Error(why));
    };

    v.onloadedmetadata = () => {
      // 0,1 s : la toute première image est souvent noire
      v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("canvas indisponible");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const duration = v.duration;
      URL.revokeObjectURL(url);
      resolve({
        poster: canvas.toDataURL("image/jpeg", 0.72),
        durationSec: duration,
      });
    };
    v.onerror = () => fail("vidéo illisible");
    v.src = url;
  });
}

/** Fichier → data URL (envoi vidéo). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("lecture impossible"));
    r.readAsDataURL(file);
  });
}
