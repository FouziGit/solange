"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Link from "next/link";
import type { Look } from "@/lib/mock";
import { imgItem, imgLook, videoLook, videoPoster } from "@/lib/img";
import { useStore } from "@/lib/store";
import { KenBurnsMedia } from "./KenBurnsMedia";
import { CarouselMedia } from "./CarouselMedia";
import {
  intentOnLeave,
  shouldPlay,
  useReduceForMarkup,
  type PlayIntent,
} from "./MemberVideo";
import { Avatar } from "../chrome/Avatar";
import { TogglePill } from "../ui/TogglePill";
import { ActionRail } from "./ActionRail";
import { CommentSheet } from "./CommentSheet";
import { ShopTheLook } from "./ShopTheLook";
import { Heart, Play } from "../chrome/icons";

type Burst = { id: number; x: number; y: number };

const group: Variants = {
  hide: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const item: Variants = {
  hide: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function FeedCard({
  look,
  active,
  index,
  total,
  inView,
}: {
  look: Look;
  active: boolean;
  index: number;
  /** Nombre de publications du fil (aria-setsize). */
  total: number;
  inView: boolean;
}) {
  const reduce = useReducedMotion();
  const {
    isLiked,
    toggleLike,
    isSaved,
    toggleSave,
    isFollowing,
    toggleFollow,
  } = useStore();
  const liked = isLiked(look.id);
  const saved = isSaved(look.id);
  const following = isFollowing(look.creator.handle);

  // social posts (actu / achats) are photo-editorial: no runway clip, media
  // comes from the first linked catalog piece, hotspots stay empty.
  const isPost = look.kind === "actu" || look.kind === "achats";
  const postHero =
    isPost && look.linkedProductIds?.length
      ? imgItem(look.linkedProductIds[0])
      : undefined;
  // Discreet content→marketplace bridge: the feed carries no prices or
  // transactions — just one quiet link towards similar pieces for sale.
  const bridgeBrand =
    look.products[0]?.brand ?? look.brandTags?.[0] ?? undefined;

  const headingId = useId();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);

  // Shop-the-look drawer state. `highlightId` scrolls-to / rings the piece the
  // shopper tapped on the media so the pin and the drawer row stay connected.
  const [shopOpen, setShopOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const hasShop = look.products.length > 0;
  // Multi-image posts render an Instagram-style swipeable carousel instead of
  // the single video/photo hero.
  const hasGallery = (look.gallery?.length ?? 0) > 1;

  /* Lecture / pause. Un carrousel ne bouge pas tout seul, et une photo
     sous « Réduire les animations » non plus (la dérive est coupée en
     CSS) : rien à mettre en pause. Ailleurs, la règle de MemberVideo —
     pas de lecture AUTO sous « Réduire les animations », mais lecture à
     la demande. */
  const reduceMarkup = useReduceForMarkup();
  const pausable = !hasGallery && !(isPost && reduceMarkup);
  const [intent, setIntent] = useState<PlayIntent>("auto");
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setIntent(intentOnLeave(intent));
  }
  const playing = pausable
    ? shouldPlay({
        active,
        intent,
        reduce: reduceMarkup && !isPost,
        saveData: false,
      })
    : active;
  const paused = active && !playing;
  const togglePlay = () => setIntent(playing ? "pause" : "play");
  const mediaLabel = isPost
    ? playing
      ? "Mettre l'animation en pause"
      : "Reprendre l'animation"
    : playing
      ? "Mettre la vidéo en pause"
      : "Lire la vidéo";

  const openShop = (id: string | null) => {
    setHighlightId(id);
    setShopOpen(true);
  };

  // caption "afficher plus / moins" — clamped to 2 lines, the toggle only
  // shows when the text actually overflows (measured in the clamped state).
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionOverflows, setCaptionOverflows] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstId = useRef(0);

  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    setCaptionOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [look.caption, inView]);

  const spawnHeart = (x: number, y: number) => {
    if (reduce) return; // no burst animation under reduced-motion
    const id = burstId.current++;
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), 800);
  };

  const onMediaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // clavier (Entrée, Espace) : pas de double-tap à attendre
    if (e.detail === 0) {
      togglePlay();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // double-tap is a "like" gesture, never an unlike
      if (!isLiked(look.id)) toggleLike(look.id);
      spawnHeart(x, y);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        togglePlay();
      }, 230);
    }
  };

  return (
    <article
      data-index={index}
      aria-labelledby={headingId}
      aria-posinset={index + 1}
      aria-setsize={total}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      {/* repère du rotor, présent même hors fenêtre : la liste des titres
          compte toutes les publications, pas seulement les 3 montées */}
      <h2 id={headingId} className="sr-only">
        Publication {index + 1} sur {total} · @{look.creator.handle}
      </h2>
      <motion.div
        animate={{
          scale: reduce ? 1 : active ? 1 : 0.95,
          opacity: active ? 1 : 0.5,
        }}
        /* L'effet de profondeur n'est animé que sur les cartes VISIBLES.
           Auparavant les 8 cartes rejouaient 0,7 s de transform à chaque
           changement de carte active, y compris hors écran : sur téléphone
           ça saccadait pendant le défilement (« ça vibre »). Hors fenêtre,
           on saute directement à l'état final — invisible, donc gratuit. */
        transition={
          inView ? { duration: 0.7, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }
        }
        // hint the compositor only for cards in the active/animating band;
        // far-off cards drop it so we don't promote dozens of layers
        style={{ willChange: inView ? "transform, opacity" : "auto" }}
        className="relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-stage md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
      >
        {/* Hors fenêtre : ni vidéo, ni animation, ni flou — mais l'image
            d'attente est là. Un simple panneau noir laissait voir une carte
            NOIRE quand on défilait vite (l'observateur n'a pas encore
            rattrapé). Une image de ~50 Ko, chargée en paresseux, coûte
            infiniment moins que ce trou visuel. */}
        {!inView ? (
          <div aria-hidden="true" className="absolute inset-0 bg-black">
            <img
              src={isPost ? postHero : videoPoster(look.id)}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              className="size-full object-cover opacity-60"
            />
          </div>
        ) : (
          <>
            {/* média — le carrousel et l'alt de l'image restent atteignables :
                ils ne sont plus les enfants (présentationnels) d'un bouton */}
            <div className="absolute inset-0">
              {hasGallery ? (
                <CarouselMedia
                  images={look.gallery!}
                  title={look.title}
                  house={
                    look.products[0]?.brand ??
                    look.brandTags?.[0] ??
                    look.creator.name
                  }
                />
              ) : (
                <KenBurnsMedia
                  seed={look.seed}
                  title={look.title}
                  house={
                    isPost
                      ? (look.brandTags?.[0] ?? look.creator.name)
                      : (look.products[0]?.brand ?? look.creator.name)
                  }
                  active={active}
                  paused={paused}
                  image={isPost ? postHero : imgLook(look.id)}
                  video={isPost ? undefined : videoLook(look.id)}
                  poster={isPost ? undefined : videoPoster(look.id)}
                  inView={inView}
                  userStarted={intent === "play"}
                />
              )}
            </div>

            {/* lecture / pause (double-tap = j'aime) : un vrai bouton posé
                SUR le média, sous le rail et la légende */}
            {pausable && (
              <button
                type="button"
                data-cursor="media"
                aria-label={mediaLabel}
                onClick={onMediaClick}
                className="absolute inset-0 focus-visible:outline-offset-[-4px]!"
              />
            )}

            {/* Pas de pins sur le média (ils chevauchaient l'en-tête) : les
                pièces du look s'ouvrent via le bouton cintre du rail. */}

            {/* pause overlay */}
            <AnimatePresence>
              {paused && active && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="grid size-20 place-items-center rounded-full bg-black/40 backdrop-blur-md ring-1 ring-bone/15">
                    <Play className="size-9 text-bone" />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* double-tap heart bursts */}
            <AnimatePresence>
              {bursts.map((b) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0.9, scale: 0.4, y: 0, rotate: -10 }}
                  animate={{ opacity: 0, scale: 1.5, y: -120, rotate: 6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: b.x,
                    top: b.y,
                    translateX: "-50%",
                    translateY: "-50%",
                  }}
                >
                  <Heart filled className="size-16 text-bone drop-shadow-lg" />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* action rail — bottom clears the floating tab bar + caption block */}
            <motion.div
              initial={false}
              animate={{ opacity: active ? 1 : 0, x: active ? 0 : 18 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: active ? 0.18 : 0,
              }}
              style={{ bottom: "calc(var(--tabbar-clearance) + 4.5rem)" }}
              className="absolute right-[max(0.75rem,env(safe-area-inset-right))] z-20 md:!bottom-40 md:right-3"
            >
              {/* pas de Partager : un look n'a pas encore d'adresse à lui */}
              <ActionRail
                liked={liked}
                saved={saved}
                likes={look.likes}
                comments={look.comments}
                onLike={() => toggleLike(look.id)}
                onSave={() => toggleSave(look.id)}
                onComment={() => setCommentsOpen(true)}
                onShop={hasShop ? () => openShop(null) : undefined}
                shopCount={look.products.length}
                active={active}
              />
            </motion.div>

            {/* bottom: caption, tags, sound, shop — staggered reveal.
            Bottom padding clears the floating mobile tab bar (0 at md). */}
            <motion.div
              variants={group}
              initial="hide"
              animate={active ? "show" : "hide"}
              style={{
                paddingBottom: "calc(var(--tabbar-clearance) + 1rem)",
              }}
              className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[calc(5rem+env(safe-area-inset-right))] md:!pb-9 md:pl-4 md:pr-20"
            >
              {/* Créateur — rangée compacte au-dessus de la légende, sur
                  TOUTES les tailles. Rien ne flotte plus en haut : le média
                  garde l'écran entier, mobile comme ordinateur. */}
              <motion.div variants={item} className="flex items-center gap-2.5">
                <Link
                  href={`/membre/${look.creator.handle}`}
                  className="flex min-h-11 min-w-0 items-center gap-2.5"
                  aria-label={`Profil de @${look.creator.handle}`}
                >
                  <Avatar
                    name={look.creator.name}
                    seed={look.creator.seed}
                    decorative
                    className="size-9 shrink-0 text-sm ring-1 ring-bone/25"
                  />
                  <span className="truncate text-[14px] font-semibold text-bone">
                    @{look.creator.handle}
                  </span>
                </Link>
                <TogglePill
                  on={following}
                  onToggle={() => toggleFollow(look.creator.handle)}
                  labelOn="Suivi"
                  labelOff="Suivre"
                  size="sm"
                />
                {/* Pas de bouton son : les clips des looks n'ont aucune piste
                    audio (ffprobe), il annonçait un son qui n'existe pas. */}
              </motion.div>

              <motion.div variants={item} className="max-w-[34ch]">
                <p
                  ref={captionRef}
                  className={`text-[13.5px] leading-relaxed text-bone/95 ${
                    captionExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {look.caption}
                </p>
                {captionOverflows && (
                  <button
                    type="button"
                    onClick={() => setCaptionExpanded((v) => !v)}
                    aria-expanded={captionExpanded}
                    className="mt-0.5 inline-flex min-h-9 items-center text-[12px] font-medium tracking-wide text-ash transition-colors hover:text-bone"
                  >
                    {captionExpanded ? "afficher moins" : "afficher plus"}
                  </button>
                )}
              </motion.div>

              {/* brands discussed in the post — sharp outline chips */}
              {isPost && look.brandTags?.length ? (
                <motion.div
                  variants={item}
                  className="flex flex-wrap gap-x-1.5 gap-y-1"
                >
                  {look.brandTags.map((b) => (
                    <span
                      key={b}
                      className="border border-bone/20 px-2.5 py-1 text-[11px] font-medium text-bone/75"
                    >
                      #{b}
                    </span>
                  ))}
                </motion.div>
              ) : null}

              <motion.div
                variants={item}
                className="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <span className="etiquette border border-bone/25 px-2 py-1 text-[11px] leading-none text-bone/80">
                  N°{String(index + 1).padStart(2, "0")}
                </span>
                {look.tags.map((t) => (
                  <span key={t} className="text-[12px] font-medium text-ash">
                    {t}
                  </span>
                ))}
              </motion.div>

              {/* Shoppable posts open the Shop-the-look drawer from the round
                  cart bubble in the action rail (freeing space here). Only
                  content-only posts keep a quiet marketplace text link. */}
              {!hasShop && bridgeBrand ? (
                <motion.div variants={item}>
                  <Link
                    href={`/decouvrir?q=${encodeURIComponent(bridgeBrand)}`}
                    data-cursor="link"
                    className="group inline-flex min-h-11 items-center gap-1.5 text-[12.5px] tracking-wide text-ash transition-colors hover:text-bone"
                  >
                    Voir des pièces similaires en vente
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </motion.div>
              ) : null}
            </motion.div>

            {/* Shop-the-look drawer — mounted at the card root so it fills the
                whole card, not just the caption strip. */}
            {hasShop && (
              <ShopTheLook
                variant="drawer"
                products={look.products}
                open={shopOpen}
                onOpenChange={setShopOpen}
                highlightId={highlightId}
              />
            )}

            {/* comment thread bottom-sheet */}
            <CommentSheet
              lookId={look.id}
              open={commentsOpen}
              onOpenChange={setCommentsOpen}
            />

            {/* progress bar */}
            <div className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-bone/10">
              <motion.div
                key={`${look.id}-${active}-${paused}`}
                className="h-full bg-bone"
                initial={{ width: 0 }}
                animate={{ width: active && !paused ? "100%" : 0 }}
                transition={{
                  duration: active && !paused ? 13 : 0.25,
                  ease: "linear",
                }}
              />
            </div>
          </>
        )}
      </motion.div>
    </article>
  );
}
