"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Avatar } from "@/components/chrome/Avatar";
import {
  conversations,
  catalogItem,
  type CatalogItem,
  type Message,
  type Conversation,
} from "@/lib/mock";
import { api, type ApiConversation } from "@/lib/api";
import { useStore } from "@/lib/store";
import { EASE, euro } from "@/lib/utils";
import {
  Verified,
  Search,
  ArrowLeft,
  Send,
  Bag,
} from "@/components/chrome/icons";

/** Champs communs CatalogItem / ApiProduct dont le fil a besoin. */
type ThreadItem = Pick<
  CatalogItem,
  "id" | "brand" | "name" | "priceEUR" | "seed" | "seller"
>;

/** Fil synthétique quand aucun fil n'existe encore avec ce vendeur. */
function syntheticConv(item: ThreadItem): Conversation {
  return {
    id: `conv-${item.id}`,
    name: item.seller,
    handle: item.seller,
    seed: item.seed,
    itemBrand: item.brand,
    itemName: item.name,
    itemSeed: item.seed,
    itemPriceEUR: item.priceEUR,
    time: "maintenant",
    unread: 0,
    messages: [],
  };
}

/**
 * When arriving from an article with ?item={id}, the offer thread MUST belong
 * to the piece's seller: first a thread with that seller already about the
 * piece, then any thread with that seller, then the synthetic thread created
 * for them. Never conversations[0] — that sent offers to the wrong seller.
 */
function threadForItem(
  item: ThreadItem | undefined,
  convs: readonly Conversation[],
): Conversation | undefined {
  if (!item) return undefined;
  return (
    convs.find((c) => c.handle === item.seller && c.itemSeed === item.seed) ??
    convs.find((c) => c.handle === item.seller) ??
    convs.find((c) => c.id === `conv-${item.id}`)
  );
}

/** Conversation serveur (GET /api/messages) → shape UI. Bilatéral : côté
    vendeur, l'interlocuteur affiché est l'ACHETEUR ; « me » = mes messages
    (fromId === myId), quel que soit mon rôle dans le fil. */
function toConversation(c: ApiConversation, myId: string): Conversation {
  const other = c.role === "seller" ? c.buyerHandle : c.sellerHandle;
  const dm = c.kind === "dm";
  return {
    id: c.id,
    name: dm ? other : c.role === "seller" ? `@${other} · acheteur` : other,
    handle: other,
    seed: other,
    itemBrand: c.itemBrand,
    itemName: c.itemName,
    itemSeed: "",
    itemPriceEUR: c.itemPriceEUR,
    time: "—",
    unread: 0,
    messages: c.messages.map((m): Message => ({
      from: m.fromId === myId ? "me" : "them",
      text: m.text,
    })),
  };
}

/** Fil DM synthétique (?to=handle) tant qu'aucun fil serveur n'existe. */
function dmConv(handle: string): Conversation {
  return {
    id: `dm-${handle}`,
    name: handle,
    handle,
    seed: handle,
    itemBrand: "Message",
    itemName: "direct",
    itemSeed: "",
    itemPriceEUR: 0,
    time: "maintenant",
    unread: 0,
    messages: [],
  };
}

/** The opening offer message seeded into the thread (10 % below asking). */
function offerMessage(item: ThreadItem): Message {
  const offer = Math.round(item.priceEUR * 0.9);
  return {
    from: "me",
    text: `Bonjour ! Le ${item.brand} ${item.name} (${euro(item.priceEUR)}) m'intéresse. Tu accepterais ${euro(offer)} ?`,
  };
}

function MessagesInner() {
  const params = useSearchParams();
  const itemId = params.get("item");
  const toHandle = params.get("to");
  const { user, serverProducts, isBlocked, toggleBlock } = useStore();

  // Pièce visée : catalogue mock d'abord, sinon annonce membre (serveur).
  const item: ThreadItem | undefined = itemId
    ? (catalogItem(itemId) ?? serverProducts.find((p) => p.id === itemId))
    : undefined;

  // Conversations serveur du membre connecté, fusionnées AVANT les mock.
  const [serverConvs, setServerConvs] = useState<Conversation[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void api.conversations().then((res) => {
      if (alive && res.ok)
        setServerConvs(
          res.data.conversations.map((c) => toConversation(c, user.id)),
        );
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const allConvs = useMemo(() => {
    const merged: Conversation[] = [];
    const seen = new Set<string>();
    for (const c of [...serverConvs, ...conversations]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }
    if (item && !merged.some((c) => c.handle === item.seller))
      merged.unshift(syntheticConv(item));
    if (
      toHandle &&
      !merged.some((c) => c.handle === toHandle && c.itemBrand === "Message")
    )
      merged.unshift(dmConv(toHandle));
    return merged;
  }, [serverConvs, item, toHandle]);

  // Une pièce du catalogue se résout de façon synchrone : fil + pré-sélection
  // sont dérivés une seule fois via des initialiseurs lazy — pas de cascade.
  // Une annonce membre arrive après hydratation du store : l'effet ci-dessous
  // sème alors l'offre, une seule fois.
  const [selId, setSelId] = useState<string | null>(() => {
    if (toHandle) return `dm-${toHandle}`;
    const ci = itemId ? catalogItem(itemId) : undefined;
    if (!ci) return null;
    return (threadForItem(ci, conversations) ?? syntheticConv(ci)).id;
  });
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Record<string, Message[]>>(() => {
    const ci = itemId ? catalogItem(itemId) : undefined;
    if (!ci) return {};
    const target = threadForItem(ci, conversations) ?? syntheticConv(ci);
    return { [target.id]: [offerMessage(ci)] };
  });
  // si un fil DM serveur existe déjà avec ce membre, on le préfère au synthétique
  useEffect(() => {
    if (!toHandle) return;
    const real = serverConvs.find(
      (c) => c.handle === toHandle && c.itemBrand === "Message",
    );
    if (real) queueMicrotask(() => setSelId(real.id));
  }, [toHandle, serverConvs]);

  const seededRef = useRef(itemId ? Boolean(catalogItem(itemId)) : true);
  useEffect(() => {
    if (seededRef.current || !item) return;
    seededRef.current = true;
    const target = threadForItem(item, allConvs) ?? syntheticConv(item);
    setSelId(target.id);
    setExtra((e) => ({
      ...e,
      [target.id]: [offerMessage(item), ...(e[target.id] ?? [])],
    }));
  }, [item, allConvs]);

  // Les fils dont le correspondant est bloqué sont masqués de la liste ET du
  // fil actif. Si la conversation ouverte devient bloquée → retour à la liste.
  const visibleConvs = useMemo(
    () => allConvs.filter((c) => !isBlocked(c.handle)),
    [allConvs, isBlocked],
  );
  const selConv = selId ? allConvs.find((c) => c.id === selId) : undefined;
  const selBlocked = selConv !== undefined && isBlocked(selConv.handle);
  useEffect(() => {
    if (selBlocked) queueMicrotask(() => setSelId(null));
  }, [selBlocked]);

  const active: Conversation | undefined = selBlocked
    ? undefined
    : (visibleConvs.find((c) => c.id === selId) ??
      threadForItem(item, visibleConvs) ??
      visibleConvs[0]);
  const thread = active
    ? [...active.messages, ...(extra[active.id] ?? [])]
    : [];

  // Menu « ⋯ » du fil actif (state local) + feedback éphémère.
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  };

  const reportActive = () => {
    if (!active) return;
    setMenuOpen(false);
    const reason = window.prompt(`Pourquoi signaler @${active.handle} ?`);
    if (!reason?.trim()) return;
    void api.report("user", active.handle, reason.trim()).then((res) => {
      showFeedback(
        res.ok
          ? "Signalement envoyé. Merci."
          : "Échec du signalement, réessaie plus tard.",
      );
    });
  };

  const blockActive = () => {
    if (!active) return;
    setMenuOpen(false);
    const wasBlocked = isBlocked(active.handle);
    toggleBlock(active.handle);
    showFeedback(
      wasBlocked ? `@${active.handle} débloqué.` : `@${active.handle} bloqué.`,
    );
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    setExtra((e) => ({
      ...e,
      [active.id]: [...(e[active.id] ?? []), { from: "me", text }],
    }));
    setDraft("");
    // Persistance serveur (fire-and-forget) — l'optimistic local reste seul
    // maître de l'affichage. convId pour un fil serveur, productId pour un
    // fil (mock ou synthétique) rattaché au vendeur de la pièce.
    if (user) {
      const isServerConv = serverConvs.some((c) => c.id === active.id);
      const isDm = !isServerConv && active.id.startsWith("dm-");
      const isItemThread = item !== undefined && active.handle === item.seller;
      if (isServerConv || isDm || isItemThread)
        void api.sendMessage({
          convId: isServerConv ? active.id : undefined,
          toHandle: isDm ? active.handle : undefined,
          productId:
            !isServerConv && !isDm && isItemThread ? item.id : undefined,
          text,
        });
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row">
      {/* conversation list */}
      <aside
        className={`flex-col border-bone/10 md:flex md:w-[340px] md:border-r ${
          selId ? "hidden md:flex" : "flex"
        }`}
      >
        <header className="px-5 pb-4 pt-10 md:pt-12">
          <p className="eyebrow text-sm text-bone/55">Boîte de réception</p>
          <h1 className="font-editorial text-4xl font-semibold tracking-tight text-bone">
            Messages
          </h1>
          <div className="glass mt-4 flex items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search className="size-4 text-ash" />
            <input
              placeholder="Rechercher une conversation…"
              aria-label="Rechercher une conversation"
              className="w-full bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-[13px]"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
          {visibleConvs.length === 0 && (
            <p className="px-3 py-6 text-[13px] text-ash">
              Aucune conversation pour le moment.
            </p>
          )}
          {visibleConvs.map((c) => {
            const on = active?.id === c.id;
            const last = (extra[c.id] ?? []).at(-1) ?? c.messages.at(-1);
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelId(c.id);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors ${
                  on ? "bg-bone/[0.07]" : "hover:bg-bone/[0.04]"
                }`}
              >
                <Avatar
                  name={c.name}
                  seed={c.seed}
                  className="size-12 text-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold text-bone">
                      {c.name}
                    </span>
                    {c.verified && <Verified className="size-3.5 text-bone" />}
                    <span className="ml-auto text-[10px] text-ash">
                      {c.time}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-ash">
                    {last?.from === "me" ? "Toi : " : ""}
                    {last?.text}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-bone text-[10px] font-bold text-ink">
                    {c.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* thread */}
      <section
        className={`flex-1 flex-col ${selId ? "flex" : "hidden md:flex"}`}
      >
        {!active && (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-ash">Aucune conversation à afficher.</p>
          </div>
        )}
        {active && (
          <>
            {/* thread header */}
            <header className="flex items-center gap-3 border-b border-bone/10 px-4 py-3 pt-10 md:pt-3">
              <button
                onClick={() => setSelId(null)}
                className="grid size-9 place-items-center rounded-full text-bone hover:bg-bone/10 md:hidden"
                aria-label="Retour"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Avatar
                name={active.name}
                seed={active.seed}
                className="size-10 text-lg"
              />
              <Link
                href={`/membre/${active.handle}`}
                className="min-w-0"
                aria-label={`Voir le profil de @${active.handle}`}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-semibold text-bone">
                    {active.name}
                  </span>
                  {active.verified && (
                    <Verified className="size-3.5 text-bone" />
                  )}
                </div>
                <span className="text-[11px] text-ash">@{active.handle}</span>
              </Link>
              <div className="relative ml-auto">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Options de la conversation"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="grid size-11 place-items-center rounded-full text-bone hover:bg-bone/10"
                >
                  <span aria-hidden className="text-xl leading-none">
                    ⋯
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <button
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setMenuOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-bone/10 bg-coal shadow-xl"
                    >
                      <button
                        role="menuitem"
                        onClick={reportActive}
                        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-bone transition-colors hover:bg-bone/[0.06]"
                      >
                        Signaler
                      </button>
                      <button
                        role="menuitem"
                        onClick={blockActive}
                        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-bone transition-colors hover:bg-bone/[0.06]"
                      >
                        {isBlocked(active.handle)
                          ? "Débloquer"
                          : `Bloquer @${active.handle}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </header>

            {/* product context — masqué pour les messages directs */}
            {active && active.itemBrand !== "Message" && (
              <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-bone/10 bg-bone/[0.03] p-2.5">
                <span className="grid size-11 place-items-center rounded-xl bg-coal text-bone/70">
                  <Bag className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="overline text-[9px] text-ash">
                    {active.itemBrand}
                  </p>
                  <p className="truncate text-[13px] text-bone">
                    {active.itemName}
                  </p>
                </div>
                <span className="font-display text-sm font-bold text-bone">
                  {euro(active.itemPriceEUR)}
                </span>
              </div>
            )}

            {/* messages */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-5">
              {thread.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE.luxe }}
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                    m.from === "me"
                      ? "self-end rounded-br-md bg-bone text-ink"
                      : "self-start rounded-bl-md bg-coal text-bone"
                  }`}
                >
                  {m.text}
                </motion.div>
              ))}
            </div>

            {/* composer — clears the floating mobile tab bar + home indicator */}
            <div className="flex items-center gap-2 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 md:pb-5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Écris un message…"
                aria-label="Écrire un message"
                className="glass h-11 flex-1 rounded-full px-4 text-base text-bone outline-none placeholder:text-ash md:text-[13.5px]"
              />
              <button
                onClick={send}
                aria-label="Envoyer le message"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-ink transition-transform active:scale-90"
              >
                <Send className="size-5" />
              </button>
            </div>
          </>
        )}
      </section>

      {/* feedback éphémère (signalement / blocage) */}
      {feedback && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-24"
        >
          <span className="rounded-full border border-bone/10 bg-coal px-4 py-2 text-[13px] text-bone shadow-xl">
            {feedback}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  );
}
