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
import { api, type ApiConversation, type PublicMember } from "@/lib/api";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { useStore } from "@/lib/store";
import { EASE, euro } from "@/lib/utils";
import { announce, type Politeness } from "@/lib/announce";
import {
  filterConversations,
  isOpenConversation,
  searchResultsLabel,
  speakerPrefix,
} from "@/lib/conversation-search";
import { normalizeHandle } from "@/lib/handle";
import {
  authorAvatar,
  conversationPeer,
  hasProfile,
  memberFor,
} from "@/lib/member-display";
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
  | "id"
  | "brand"
  | "name"
  | "priceEUR"
  | "seed"
  | "seller"
  | "sellerId"
  | "sellerAvatar"
>;

/** Un fil à l'écran : l'interlocuteur porte son compte et sa photo.
    `avatar` undefined : fil de démonstration (portrait de démo possible). */
type Conv = Conversation & {
  avatar?: string | null;
  otherId?: string | null;
};

/** Fil synthétique quand aucun fil n'existe encore avec ce vendeur. Pièce
    d'un membre : son compte et sa photo ; pièce de démo : comme avant. */
function syntheticConv(item: ThreadItem): Conv {
  const seller = item.sellerId
    ? authorAvatar(item.sellerId, item.seller, item.sellerAvatar)
    : null;
  return {
    id: `conv-${item.id}`,
    name: item.seller,
    handle: item.seller,
    seed: seller?.seed ?? item.seed,
    avatar: seller?.src,
    otherId: item.sellerId,
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
  convs: readonly Conv[],
): Conv | undefined {
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
function toConversation(c: ApiConversation, myId: string): Conv {
  const peer = conversationPeer(c);
  const other = peer.handle;
  const face = authorAvatar(peer.id, peer.handle, peer.avatar);
  const dm = c.kind === "dm";
  return {
    id: c.id,
    name: dm ? other : c.role === "seller" ? `@${other} · acheteur` : other,
    handle: other,
    seed: face.seed,
    avatar: face.src,
    otherId: peer.id,
    itemBrand: c.itemBrand,
    itemName: c.itemName,
    itemSeed: "",
    itemPriceEUR: c.itemPriceEUR,
    orderId: c.orderId,
    time: "—",
    unread: 0,
    messages: c.messages.map((m): Message => ({
      from: m.fromId === myId ? "me" : "them",
      text: m.text,
    })),
  };
}

/** Fil DM synthétique (?to=handle) tant qu'aucun fil serveur n'existe.
    `key` : le handle demandé (id stable du fil) ; `m` : le membre résolu,
    avec son handle actuel et sa photo, dès que /api/members a répondu. */
function dmConv(key: string, m: PublicMember | null): Conv {
  const handle = m?.handle ?? key;
  return {
    id: `dm-${key}`,
    name: handle,
    handle,
    seed: m?.id ?? key,
    avatar: m?.avatar ?? null,
    otherId: m?.id ?? null,
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
  // handle demandé par ?to=, sous sa forme canonique (clé du fil synthétique)
  const toKey = toHandle ? normalizeHandle(toHandle) : "";
  const { user, serverProducts, isBlocked, toggleBlock } = useStore();

  // Pièce visée : catalogue mock d'abord, sinon annonce membre (serveur).
  const item: ThreadItem | undefined = itemId
    ? (catalogItem(itemId) ?? serverProducts.find((p) => p.id === itemId))
    : undefined;

  // Conversations serveur du membre connecté, fusionnées AVANT les mock.
  const [serverConvs, setServerConvs] = useState<Conv[]>([]);
  // échec de chargement des fils serveur : annoncé dans la liste (lot 0),
  // retry incrémente la clé pour relancer l'effet
  const [convError, setConvError] = useState<string | null>(null);
  const [convRetry, setConvRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void api.conversations().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setServerConvs(
          res.data.conversations.map((c) => toConversation(c, user.id)),
        );
        setConvError(null);
      } else {
        setConvError(res.error);
        announce(`Tes fils n'ont pas chargé — ${res.error}`, "assertive");
      }
    });
    return () => {
      alive = false;
    };
  }, [user, convRetry]);

  /* ?to= : le membre visé, par /api/members — photo et handle actuel (un
     ancien @ encore renvoyé mène au bon fil). Absent de la réponse : il
     n'existe pas ou plus, on le dit au lieu d'ouvrir un fil mort. Hors
     ligne : on garde le fil demandé, l'envoi dira ce qu'il en est. */
  const [dmLookup, setDmLookup] = useState<{
    key: string;
    member: PublicMember | null;
    found: boolean;
  } | null>(null);
  useEffect(() => {
    if (!toKey) return;
    let alive = true;
    void api.members([toKey]).then((res) => {
      if (!alive) return;
      const member = res.ok ? memberFor(res.data.members, toKey) : null;
      setDmLookup({ key: toKey, member, found: !res.ok || member !== null });
      if (res.ok && !member) announce("Membre introuvable");
    });
    return () => {
      alive = false;
    };
  }, [toKey]);
  const dmTarget = dmLookup?.key === toKey ? dmLookup : null;
  const dmMember = dmTarget?.member ?? null;
  const dmHandle = dmMember?.handle ?? toKey;
  const dmMissing = dmTarget !== null && !dmTarget.found;

  const allConvs = useMemo(() => {
    const merged: Conv[] = [];
    const seen = new Set<string>();
    for (const c of [...serverConvs, ...conversations]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }
    if (item && !merged.some((c) => c.handle === item.seller))
      merged.unshift(syntheticConv(item));
    if (
      toKey &&
      !dmMissing &&
      !merged.some((c) => c.handle === dmHandle && c.itemBrand === "Message")
    )
      merged.unshift(dmConv(toKey, dmMember));
    return merged;
  }, [serverConvs, item, toKey, dmMissing, dmHandle, dmMember]);

  // Une pièce du catalogue se résout de façon synchrone : fil + pré-sélection
  // sont dérivés une seule fois via des initialiseurs lazy — pas de cascade.
  // Une annonce membre arrive après hydratation du store : l'effet ci-dessous
  // sème alors l'offre, une seule fois.
  const [selId, setSelId] = useState<string | null>(() => {
    if (toKey) return `dm-${toKey}`;
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
    if (!toKey) return;
    const real = serverConvs.find(
      (c) => c.handle === dmHandle && c.itemBrand === "Message",
    );
    if (real) queueMicrotask(() => setSelId(real.id));
  }, [toKey, dmHandle, serverConvs]);

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

  // Recherche : filtre la liste (pas le fil ouvert) ; le nombre de résultats
  // est lu une fois la frappe posée.
  const [query, setQuery] = useState("");
  const listed = useMemo(
    () => filterConversations(visibleConvs, query),
    [visibleConvs, query],
  );
  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(
      () => announce(searchResultsLabel(listed.length)),
      600,
    );
    return () => clearTimeout(t);
  }, [query, listed.length]);

  // Focus : ouvrir un fil masque la liste (mobile) → le titre du fil prend
  // le focus ; « Retour » le rend au fil d'origine dans la liste.
  const threadTitleRef = useRef<HTMLHeadingElement>(null);
  const listTitleRef = useRef<HTMLHeadingElement>(null);
  const convButtons = useRef(new Map<string, HTMLButtonElement>());
  const [focusReq, setFocusReq] = useState<
    { to: "thread" } | { to: "list"; id?: string } | null
  >(null);
  useEffect(() => {
    if (!focusReq) return;
    if (focusReq.to === "thread") threadTitleRef.current?.focus();
    else
      (
        (focusReq.id && convButtons.current.get(focusReq.id)) ||
        listTitleRef.current
      )?.focus();
  }, [focusReq]);

  // le fil demandé par ?to= n'existe pas : aucun autre fil à sa place
  const dmNotFound = dmMissing && selId === `dm-${toKey}`;
  const active: Conv | undefined =
    selBlocked || dmNotFound
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
  // Le toast est visuel ; la lecture passe par announce() (région toujours
  // montée), assertive pour une erreur.
  const showFeedback = (msg: string, politeness: Politeness = "polite") => {
    setFeedback(msg);
    announce(msg, politeness);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  };

  const [reportOpen, setReportOpen] = useState(false);
  // le menu disparaît avec l'entrée touchée : le focus passe d'abord sur
  // « Options », que la feuille de signalement lui rendra à la fermeture
  const optionsRef = useRef<HTMLButtonElement>(null);
  const reportActive = () => {
    if (!active) return;
    optionsRef.current?.focus();
    setMenuOpen(false);
    setReportOpen(true);
  };

  const blockActive = () => {
    if (!active) return;
    setMenuOpen(false);
    const wasBlocked = isBlocked(active.handle);
    toggleBlock(active.handle);
    // le fil bloqué disparaît avec le menu qui avait le focus : retour à la
    // liste dans le même rendu, focus sur son titre
    if (!wasBlocked) {
      setSelId(null);
      setFocusReq({ to: "list" });
    }
    showFeedback(
      wasBlocked ? `@${active.handle} débloqué.` : `@${active.handle} bloqué.`,
    );
  };

  const openConv = (id: string) => {
    setMenuOpen(false);
    // fil déjà ouvert (desktop) : aucun rendu à attendre
    if (id === selId) threadTitleRef.current?.focus();
    else {
      setSelId(id);
      setFocusReq({ to: "thread" });
    }
  };
  const backToList = () => {
    setSelId(null);
    setFocusReq({ to: "list", id: active?.id });
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !active) return;
    setExtra((e) => ({
      ...e,
      [active.id]: [...(e[active.id] ?? []), { from: "me", text }],
    }));
    setDraft("");
    // Persistance serveur, optimiste MAIS honnête (lot 0) : si l'écriture
    // échoue, le message optimiste est retiré, le texte revient dans le champ
    // et l'erreur s'affiche — rien ne se perd en silence. convId pour un fil
    // serveur, productId pour un fil (mock/synthétique) lié au vendeur.
    if (user) {
      const isServerConv = serverConvs.some((c) => c.id === active.id);
      const isDm = !isServerConv && active.id.startsWith("dm-");
      const isItemThread = item !== undefined && active.handle === item.seller;
      if (isServerConv || isDm || isItemThread) {
        const convId = active.id;
        void api
          .sendMessage({
            convId: isServerConv ? convId : undefined,
            toHandle: isDm ? active.handle : undefined,
            productId:
              !isServerConv && !isDm && isItemThread ? item.id : undefined,
            text,
          })
          .then((res) => {
            if (res.ok) return;
            setExtra((e) => {
              const list = e[convId] ?? [];
              const i = list.findLastIndex(
                (m) => m.from === "me" && m.text === text,
              );
              if (i === -1) return e;
              return { ...e, [convId]: list.toSpliced(i, 1) };
            });
            setDraft((cur) => cur || text);
            showFeedback(`Message non envoyé — ${res.error}`, "assertive");
          });
      }
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
        <header className="px-5 pb-4 pt-[calc(env(safe-area-inset-top)+2.5rem)] md:pt-[calc(env(safe-area-inset-top)+3rem)]">
          <p className="eyebrow text-sm text-ash">Boîte de réception</p>
          <h1
            ref={listTitleRef}
            tabIndex={-1}
            className="font-editorial text-4xl font-semibold tracking-tight text-bone"
          >
            Messages
          </h1>
          <div className="glass mt-4 flex items-center gap-2 rounded-full px-3.5 py-2.5">
            <Search className="size-4 text-ash" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une conversation…"
              aria-label="Rechercher une conversation"
              className="w-full appearance-none bg-transparent text-base text-bone outline-none placeholder:text-ash md:text-[13px]"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
          {/* annoncé par announce() au chargement : pas de région créée
              en même temps que son texte */}
          {convError && (
            <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 border border-bone/15 px-3.5 py-3">
              <p className="text-[13px] text-ash">
                Tes fils n&apos;ont pas chargé — {convError}
              </p>
              <button
                type="button"
                onClick={() => setConvRetry((n) => n + 1)}
                data-cursor="link"
                className="text-[13px] font-semibold text-bone underline-offset-4 hover:underline"
              >
                Réessayer
              </button>
            </div>
          )}
          {visibleConvs.length === 0 && (
            <p className="px-3 py-6 text-[13px] text-ash">
              Aucune conversation. Écris à un vendeur depuis une pièce du Marché
              — la discussion vivra ici.
            </p>
          )}
          {visibleConvs.length > 0 && listed.length === 0 && (
            <p className="px-3 py-6 text-[13px] text-ash">
              Aucune conversation ne correspond à « {query.trim()} ».
            </p>
          )}
          {listed.map((c) => {
            const on = active?.id === c.id;
            const last = (extra[c.id] ?? []).at(-1) ?? c.messages.at(-1);
            return (
              <button
                key={c.id}
                ref={(el) => {
                  if (el) convButtons.current.set(c.id, el);
                  else convButtons.current.delete(c.id);
                }}
                onClick={() => openConv(c.id)}
                aria-current={
                  isOpenConversation(c.id, selId) ? "true" : undefined
                }
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors ${
                  on ? "bg-bone/[0.07]" : "hover:bg-bone/[0.04]"
                }`}
              >
                <Avatar
                  name={c.name}
                  seed={c.seed}
                  src={c.avatar}
                  decorative
                  className="size-12 text-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold text-bone">
                      {c.name}
                    </span>
                    {c.verified && <Verified className="size-3.5 text-bone" />}
                    <span className="ml-auto text-[11px] text-ash">
                      {c.time}
                    </span>
                  </div>
                  <p className="truncate text-[12px] text-ash">
                    {last?.from === "me" ? "Toi : " : ""}
                    {last?.text}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="relative grid size-5 place-items-center rounded-full bg-bone text-[11px] font-bold text-ink">
                    {c.unread}
                    <span className="sr-only">
                      {c.unread > 1 ? " messages non lus" : " message non lu"}
                    </span>
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
        {!active && !dmNotFound && (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-ash">Aucune conversation à afficher.</p>
          </div>
        )}
        {dmNotFound && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h2 className="font-editorial text-2xl font-semibold tracking-tight text-bone">
              Membre introuvable
            </h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ash">
              Aucun membre ne répond au nom de{" "}
              <span className="text-bone">@{toKey}</span>. Le compte a peut-être
              été supprimé, ou le lien est périmé.
            </p>
            {/* sur téléphone, la liste est masquée tant qu'un fil est choisi */}
            <button
              type="button"
              onClick={backToList}
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-bone/25 px-5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10 md:hidden"
            >
              Voir mes messages
            </button>
          </div>
        )}
        {active && (
          <>
            {/* thread header */}
            <header className="flex items-center gap-3 border-b border-bone/10 px-4 py-3 pt-[calc(env(safe-area-inset-top)+2.5rem)] md:pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              {/* 44 px au doigt, pastille visuelle de 36 px ; -mx-1 garde
                  l'encombrement d'avant */}
              <button
                onClick={backToList}
                className="group -mx-1 grid size-11 shrink-0 place-items-center rounded-full text-bone md:hidden"
                aria-label="Retour"
              >
                <span className="grid size-9 place-items-center rounded-full group-hover:bg-bone/10">
                  <ArrowLeft className="size-5" />
                </span>
              </button>
              <Avatar
                name={active.name}
                seed={active.seed}
                src={active.avatar}
                decorative
                className="size-10 text-lg"
              />
              {/* titre du fil (focalisé à l'ouverture) ; le lien vers le
                  profil couvre tout le bloc, comme avant — pas de lien
                  vers un compte supprimé */}
              <div className="relative min-w-0">
                <h2
                  ref={threadTitleRef}
                  tabIndex={-1}
                  className="flex items-center gap-1"
                >
                  <span className="sr-only">Conversation avec </span>
                  <span className="truncate text-sm font-semibold text-bone">
                    {active.name}
                  </span>
                  {active.verified && (
                    <Verified className="size-3.5 text-bone" />
                  )}
                </h2>
                {hasProfile(active.handle) ? (
                  <Link
                    href={`/membre/${encodeURIComponent(active.handle)}`}
                    className="block after:absolute after:inset-0 after:content-['']"
                    aria-label={`Voir le profil de @${active.handle}`}
                  >
                    <span className="text-[11px] text-ash">
                      @{active.handle}
                    </span>
                  </Link>
                ) : (
                  <span className="block text-[11px] text-ash">
                    @{active.handle}
                  </span>
                )}
              </div>
              <div className="relative ml-auto">
                <button
                  ref={optionsRef}
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
                  <p className="text-[12px] text-ash">{active.itemBrand}</p>
                  <p className="truncate text-[13px] text-bone">
                    {active.itemName}
                  </p>
                </div>
                <span className="font-display text-sm font-bold text-bone">
                  {euro(active.itemPriceEUR)}
                </span>
                {/* une commande existe sur cette pièce : référence directe */}
                {active.orderId && (
                  <Link
                    href={`/commande/${active.orderId}`}
                    data-cursor="link"
                    className="shrink-0 border border-bone/25 px-2.5 py-1.5 text-[11px] font-semibold text-bone transition-colors hover:bg-bone/10"
                  >
                    Commande
                  </Link>
                )}
              </div>
            )}

            {/* messages — role="log" lit chaque nouvelle bulle (envoi
                confirmé) ; remonté à chaque fil (key) pour ne pas relire
                tout un fil quand on en change. L'auteur n'est pas que dans
                l'alignement : préfixe masqué « Toi : » / « @handle : ». */}
            <div
              key={active.id}
              role="log"
              aria-label={`Conversation avec @${active.handle}`}
              tabIndex={0}
              className="flex-1 overflow-y-auto px-4 py-5"
            >
              <ol role="list" className="flex flex-col gap-2">
                {thread.map((m, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE.luxe }}
                    className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                      m.from === "me"
                        ? "self-end rounded-br-md bg-bone text-ink"
                        : "self-start rounded-bl-md bg-coal text-bone"
                    }`}
                  >
                    <span className="sr-only">
                      {speakerPrefix(m.from, active.handle)}
                    </span>
                    {m.text}
                  </motion.li>
                ))}
              </ol>
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

      {/* feedback éphémère (blocage, envoi échoué) — visuel seulement, la
          lecture passe par announce() dans showFeedback */}
      {feedback && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-24">
          <span className="rounded-full border border-bone/10 bg-coal px-4 py-2 text-[13px] text-bone shadow-xl">
            {feedback}
          </span>
        </div>
      )}
      {active && (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={active.handle}
          targetLabel={`@${active.handle}`}
        />
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
