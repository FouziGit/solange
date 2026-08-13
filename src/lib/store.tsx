"use client";

/* ============================================================
   SOLANGE — client store (likes / saves / follows)
   In-memory React context seeded from the mock dataset.
   Wave-B consumers MUST route every like/save/follow through
   useStore() — never local useState — so the UI stays in sync
   across views. No persistence, no backend (mock-only).
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
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
};

const StoreContext = createContext<Store | null>(null);

/** Immutably toggle membership of `key` in a Set, returning a new Set. */
function toggle<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
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

  const isLiked = useCallback((id: string) => liked.has(id), [liked]);
  const toggleLike = useCallback(
    (id: string) => setLiked((s) => toggle(s, id)),
    [],
  );

  const isSaved = useCallback((id: string) => saved.has(id), [saved]);
  const toggleSave = useCallback(
    (id: string) => setSaved((s) => toggle(s, id)),
    [],
  );

  const isFollowing = useCallback(
    (handle: string) => following.has(handle),
    [following],
  );
  const toggleFollow = useCallback(
    (handle: string) => setFollowing((s) => toggle(s, handle)),
    [],
  );

  const savedItems = useCallback(
    () =>
      [...saved]
        .map((id) => catalogItem(id))
        .filter((it): it is CatalogItem => it !== undefined),
    [saved],
  );

  const isJoined = useCallback(
    (communityId: string) => joined.has(communityId),
    [joined],
  );
  const toggleJoin = useCallback(
    (communityId: string) => setJoined((s) => toggle(s, communityId)),
    [],
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
