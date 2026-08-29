"use client";

/* ============================================================
   SOLANGE — client store (session, likes / saves / follows,
   annonces membres, commandes).
   Connecté au backend Netlify Functions : hydratation via
   /api/me + /api/products au montage, écritures optimistes
   synchronisées quand une session existe, fallback invité
   (mémoire seule) sinon. Les consommateurs passent TOUJOURS
   par useStore() — jamais un useState local.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  catalogItem,
  followedHandles,
  joinedCommunityIds,
  savedIds,
  type CatalogItem,
} from "@/lib/mock";
import { api, type ApiProduct, type SessionUser } from "@/lib/api";

/** A completed (simulated) purchase — recorded for the profile order history. */
export type Order = {
  id: string;
  item: CatalogItem;
  protection: number;
  shipping: number;
  total: number;
  last4: string;
  date: string;
};

type Store = {
  isLiked(id: string): boolean;
  toggleLike(id: string): void;
  isSaved(id: string): boolean;
  toggleSave(id: string): void;
  isFollowing(handle: string): boolean;
  toggleFollow(handle: string): void;
  savedItems(): CatalogItem[];
  isJoined(communityId: string): boolean;
  toggleJoin(communityId: string): void;
  orders: Order[];
  addOrder(order: Order): void;
  /* — session (backend réel) — */
  user: SessionUser | null;
  authReady: boolean;
  refreshSession(): Promise<void>;
  signOut(): Promise<void>;
  /* — annonces membres + état vendu — */
  serverProducts: ApiProduct[];
  soldSeeds: string[];
  refreshProducts(): Promise<void>;
  isSold(id: string): boolean;
  isBlocked(handle: string): boolean;
  toggleBlock(handle: string): void;
  likeCount(id: string, base: number): number;
};

const StoreContext = createContext<Store | null>(null);

/** Immutably toggle membership of `key` in a Set, returning a new Set. */
function toggle<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Pseudo-CatalogItem pour une commande serveur dont l'item n'est pas local. */
function orderItem(o: {
  productId: string;
  brand: string;
  name: string;
  priceEUR: number;
}): CatalogItem {
  return (
    catalogItem(o.productId) ?? {
      id: o.productId,
      brand: o.brand,
      name: o.name,
      priceEUR: o.priceEUR,
      size: "",
      condition: "",
      seed: `api-${o.productId}`,
      category: "Archive",
      seller: "",
      likes: 0,
    }
  );
}

export function SolangeProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set(savedIds));
  const [following, setFollowing] = useState<Set<string>>(
    () => new Set(followedHandles),
  );
  const [joined, setJoined] = useState<Set<string>>(
    () => new Set(joinedCommunityIds),
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [serverProducts, setServerProducts] = useState<ApiProduct[]>([]);
  const [soldSeeds, setSoldSeeds] = useState<string[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.me();
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        const s = res.data.social;
        if (s) {
          // état serveur = source de vérité pour un membre connecté
          // Chaque clé peut manquer (le serveur ne stocke que les kinds touchés)
          setLiked(new Set(s.liked ?? []));
          setBlocked(new Set(s.blocked ?? []));
          setSaved(new Set([...savedIds, ...(s.saved ?? [])]));
          setFollowing(new Set([...followedHandles, ...(s.follows ?? [])]));
          setJoined(new Set([...joinedCommunityIds, ...(s.joined ?? [])]));
        }
        const o = res.data.orders ?? [];
        setOrders(
          o.map((so) => ({
            id: so.id,
            item: orderItem(so),
            protection: so.protectionEUR,
            shipping: so.shippingEUR,
            total: so.totalEUR,
            last4: "démo",
            date: new Date(so.createdAt).toLocaleDateString("fr-FR"),
          })),
        );
      } else {
        setUser(null);
      }
    } catch {
      // un payload inattendu ne doit jamais bloquer l'app sur le splash
      setUser(null);
    }
    setAuthReady(true);
  }, []);

  const refreshProducts = useCallback(async () => {
    const res = await api.products();
    if (res.ok) {
      setServerProducts(res.data.products);
      setSoldSeeds(res.data.soldSeeds);
      setLikesMap(res.data.likesMap ?? {});
    }
  }, []);

  useEffect(() => {
    // hydratation réseau différée d'un tick — jamais de setState synchrone
    queueMicrotask(() => {
      void refreshSession();
      void refreshProducts();
    });
  }, [refreshSession, refreshProducts]);

  const addOrder = useCallback(
    (order: Order) => setOrders((cur) => [order, ...cur]),
    [],
  );

  /** Toggle optimiste + synchro serveur (fire-and-forget) si connecté. */
  const sync = useCallback(
    (
      kind: "liked" | "saved" | "follows" | "joined" | "blocked",
      id: string,
      on: boolean,
    ) => {
      if (user) void api.social(kind, id, on);
    },
    [user],
  );

  const isLiked = useCallback((id: string) => liked.has(id), [liked]);
  const toggleLike = useCallback(
    (id: string) =>
      setLiked((s) => {
        const next = toggle(s, id);
        sync("liked", id, next.has(id));
        return next;
      }),
    [sync],
  );

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);
  const toggleSave = useCallback(
    (id: string) =>
      setSaved((s) => {
        const next = toggle(s, id);
        sync("saved", id, next.has(id));
        return next;
      }),
    [sync],
  );

  const isFollowing = useCallback(
    (handle: string) => following.has(handle),
    [following],
  );
  const toggleFollow = useCallback(
    (handle: string) =>
      setFollowing((s) => {
        const next = toggle(s, handle);
        sync("follows", handle, next.has(handle));
        return next;
      }),
    [sync],
  );

  const savedItems = useCallback(
    () =>
      [...saved]
        .map((id) => catalogItem(id) ?? serverProducts.find((p) => p.id === id))
        .filter((it): it is CatalogItem => it !== undefined),
    [saved, serverProducts],
  );

  const isJoined = useCallback(
    (communityId: string) => joined.has(communityId),
    [joined],
  );
  const toggleJoin = useCallback(
    (communityId: string) =>
      setJoined((s) => {
        const next = toggle(s, communityId);
        sync("joined", communityId, next.has(communityId));
        return next;
      }),
    [sync],
  );

  const isBlocked = useCallback(
    (handle: string) => blocked.has(handle),
    [blocked],
  );
  const toggleBlock = useCallback(
    (handle: string) =>
      setBlocked((s) => {
        const next = toggle(s, handle);
        sync("blocked", handle, next.has(handle));
        return next;
      }),
    [sync],
  );

  /** Compteur affiché = base (mock/annonce) + likes membres agrégés serveur. */
  const likeCount = useCallback(
    (id: string, base: number) => base + (likesMap[id] ?? 0),
    [likesMap],
  );

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setOrders([]);
    setLiked(new Set());
    setSaved(new Set(savedIds));
    setFollowing(new Set(followedHandles));
    setJoined(new Set(joinedCommunityIds));
  }, []);

  const isSold = useCallback(
    (id: string) =>
      soldSeeds.includes(id) ||
      serverProducts.some((p) => p.id === id && p.status === "sold"),
    [soldSeeds, serverProducts],
  );

  const value = useMemo<Store>(
    () => ({
      isLiked,
      toggleLike,
      isSaved,
      toggleSave,
      isFollowing,
      toggleFollow,
      savedItems,
      isJoined,
      toggleJoin,
      orders,
      addOrder,
      user,
      authReady,
      refreshSession,
      signOut,
      serverProducts,
      soldSeeds,
      refreshProducts,
      isSold,
      isBlocked,
      toggleBlock,
      likeCount,
    }),
    [
      isLiked,
      toggleLike,
      isSaved,
      toggleSave,
      isFollowing,
      toggleFollow,
      savedItems,
      isJoined,
      toggleJoin,
      orders,
      addOrder,
      user,
      authReady,
      refreshSession,
      signOut,
      serverProducts,
      soldSeeds,
      refreshProducts,
      isSold,
      isBlocked,
      toggleBlock,
      likeCount,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (ctx === null) {
    throw new Error("useStore must be used within a <SolangeProvider>");
  }
  return ctx;
}
