/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Link from "next/link";
import type { ApiPost } from "@/lib/api";
import { useStore } from "@/lib/store";
import { catalogItem } from "@/lib/mock";
import { compact, gradientFor, initials } from "@/lib/utils";
import { CarouselMedia } from "./CarouselMedia";
import { MemberVideo } from "./MemberVideo";
import { RailAction } from "./RailAction";
import { ShopTheLook } from "./ShopTheLook";
import { ReportSheet } from "../ui/ReportSheet";
import { Heart, Bookmark, Hanger } from "../chrome/icons";

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

/** Bouton du rail d'actions — même format que le rail des looks (glass, 48px). */

/**
 * Carte plein écran d'une publication membre (backend /api/posts) dans le
 * scroll vertical. Même gabarit que FeedCard : stage snap 100dvh, en-tête en
 * haut (safe-area), rail d'actions à droite, légende clampée en bas. Média =
 * première image de la galerie (carrousel si plusieurs), dégradé monogramme
 * si le post n'a pas d'image.
 */
export function MemberPostCard({
  post,
  active,
  index,
  inView,
}: {
  post: ApiPost;
  active: boolean;
  index: number;
  inView: boolean;
}) {
  const reduce = useReducedMotion();
  const {
    isLiked,
    toggleLike,
    isSaved,
    toggleSave,
    likeCount,
    serverProducts,
  } = useStore();
  const liked = isLiked(post.id);
  const saved = isSaved(post.id);

  const hasGallery = post.gallery.length > 1;
  const hero = post.gallery[0];
  const altText = `Publication de ${post.authorName} (@${post.authorHandle})`;

  /* Lot 5 : pièces taguées — « Shop the look » sur une publication membre
     exactement comme sur un look éditorial (même primitive, même feuille). */
  const [shopOpen, setShopOpen] = useState(false);
  const taggedPieces = useMemo(
    () =>
      (post.productIds ?? [])
        .map((id) => {
          const seed = catalogItem(id);
          if (seed) return { ...seed, hotspot: { x: 50, y: 50 } };
          const p = serverProducts.find((sp) => sp.id === id);
          return p
            ? {
                id: p.id,
                name: p.name,
                brand: p.brand,
                priceEUR: p.priceEUR,
                size: p.size,
                condition: p.condition,
                hotspot: { x: 50, y: 50 },
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [post.productIds, serverProducts],
  );

  // légende "afficher plus / moins" — même pattern que FeedCard : clamp 2
  // lignes, le toggle n'apparaît que si le texte déborde réellement.
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionOverflows, setCaptionOverflows] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    setCaptionOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [post.caption, inView]);

  // toast de confirmation (signalement) — éphémère, purement local

  const [reportOpen, setReportOpen] = useState(false);
  const onReport = () => setReportOpen(true);

  return (
    <section
      data-index={index}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      <motion.div
        animate={{
          scale: reduce ? 1 : active ? 1 : 0.95,
          opacity: active ? 1 : 0.5,
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: inView ? "transform, opacity" : "auto" }}
        className="relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-stage md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
      >
        {/* Hors fenêtre : panneau noir plat, rien ne peint offscreen. */}
        {!inView ? (
          <div aria-hidden="true" className="absolute inset-0 bg-black" />
        ) : (
          <>
            {/* média : carrousel si plusieurs images, image seule sinon,
                dégradé monogramme si la publication n'a pas de photo */}
            <div className="absolute inset-0">
              {post.video ? (
                /* Lot 5 : une vidéo membre se lit comme un look éditorial */
                <MemberVideo
                  src={post.video}
                  poster={post.poster}
                  alt={altText}
                  active={active}
                  inView={inView}
                />
              ) : hasGallery ? (
                <CarouselMedia
                  images={post.gallery}
                  title={`Publication de ${post.authorName}`}
                  house={post.brandTags[0] ?? post.authorName}
                />
              ) : hero ? (
                <div className="absolute inset-0 bg-black">
                  {/* fond flouté : le cliché entier reste visible sans crop dur */}
                  <img
                    src={hero}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.45]"
                  />
                  <img
                    src={hero}
                    alt={altText}
                    draggable={false}
                    className="absolute inset-0 size-full object-contain"
                  />
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: gradientFor(post.authorHandle) }}
                >
                  <div className="absolute inset-0 bg-black/45" />
                  <span className="absolute inset-0 grid place-items-center font-display text-7xl font-bold tracking-widest text-bone/40">
                    {initials(post.authorName)}
                  </span>
                </div>
              )}

              {/* scrims de lisibilité — identiques au média des looks
                  (CarouselMedia embarque déjà les siens) */}
              {!hasGallery && !post.video && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                </>
              )}
            </div>

            {/* haut : auteur (lien profil membre) — dégage la barre flottante
                via safe-area, mêmes paddings que FeedCard */}
            <motion.div
              initial={false}
              animate={{ opacity: active ? 1 : 0, y: active ? 0 : -12 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: active ? 0.1 : 0,
              }}
              style={{
                paddingTop: "calc(env(safe-area-inset-top) + 6.75rem)",
              }}
              className="absolute inset-x-0 top-0 z-20 hidden items-start justify-between gap-3 p-4 md:flex"
            >
              <Link
                href={`/membre/${encodeURIComponent(post.authorHandle)}`}
                data-cursor="link"
                className="group flex min-h-11 min-w-0 items-center gap-3"
                aria-label={`Voir le profil de @${post.authorHandle}`}
              >
                <div className="relative shrink-0">
                  <span className="absolute -inset-[3px] rounded-full bg-bone/25" />
                  {/* monogramme initiales — pas de portrait pour les membres */}
                  <span
                    className="relative grid size-11 place-items-center overflow-hidden rounded-full text-2xl ring-2 ring-ink"
                    style={{ background: gradientFor(post.authorHandle) }}
                  >
                    <span className="font-display text-[0.42em] font-bold tracking-wide text-bone/85">
                      {initials(post.authorName)}
                    </span>
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-bone transition-colors group-hover:text-bone/80">
                    @{post.authorHandle}
                  </span>
                  <p className="truncate text-[11px] text-ash">
                    {post.authorName} · membre
                  </p>
                </div>
              </Link>
            </motion.div>

            {/* rail d'actions à droite — même dégagement que FeedCard */}
            <motion.div
              initial={false}
              animate={{ opacity: active ? 1 : 0, x: active ? 0 : 18 }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: active ? 0.18 : 0,
              }}
              style={{ bottom: "calc(var(--tabbar-clearance) + 4.5rem)" }}
              className="absolute right-3 z-20 md:!bottom-40"
            >
              <div className="flex flex-col items-center gap-5">
                {taggedPieces.length > 0 && (
                  <RailAction
                    label={`${taggedPieces.length} pièce${taggedPieces.length > 1 ? "s" : ""}`}
                    onClick={() => setShopOpen(true)}
                    ariaLabel="Voir les pièces à shopper"
                  >
                    <Hanger className="size-6 text-bone" />
                  </RailAction>
                )}

                <RailAction
                  label={compact(likeCount(post.id, 0) + (liked ? 1 : 0))}
                  onClick={() => toggleLike(post.id)}
                  pressed={liked}
                  ariaLabel={liked ? "Retirer le j'aime" : "J'aime"}
                >
                  <motion.span
                    key={liked ? "on" : "off"}
                    animate={liked && !reduce ? { scale: [1, 1.35, 1] } : {}}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <Heart filled={liked} className="size-6 text-bone" />
                  </motion.span>
                </RailAction>

                <RailAction
                  label={saved ? "Enregistré" : "Garder"}
                  onClick={() => toggleSave(post.id)}
                  accent
                  pressed={saved}
                  ariaLabel={
                    saved ? "Retirer des enregistrements" : "Enregistrer"
                  }
                >
                  <Bookmark filled={saved} className="size-6 text-bone" />
                </RailAction>

                {/* signalement — discret, glyphe seul, cible 44px */}
                <button
                  onClick={onReport}
                  data-cursor="link"
                  aria-label="Signaler cette publication"
                  className="grid size-11 place-items-center rounded-full transition-transform active:scale-90"
                >
                  <span className="glass grid size-9 place-items-center rounded-full text-[16px] leading-none tracking-[0.2em] text-bone/70 transition-colors hover:text-bone">
                    ⋯
                  </span>
                </button>
              </div>
            </motion.div>

            {/* bas : légende clampée + chips marques — révélation étagée,
                le padding dégage la barre d'onglets mobile flottante */}
            <motion.div
              variants={group}
              initial="hide"
              animate={active ? "show" : "hide"}
              style={{
                paddingBottom: "calc(var(--tabbar-clearance) + 1rem)",
              }}
              className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-4 pr-20 md:!pb-9"
            >
              {/* auteur — rangée compacte en bas (mobile), profil cliquable */}
              <motion.div
                variants={item}
                className="flex items-center gap-2.5 md:hidden"
              >
                <Link
                  href={`/membre/${encodeURIComponent(post.authorHandle)}`}
                  className="flex min-h-11 min-w-0 items-center gap-2.5"
                  aria-label={`Profil de @${post.authorHandle}`}
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-bone/25"
                    style={{ background: gradientFor(post.authorHandle) }}
                  >
                    <span className="font-display text-[11px] font-bold tracking-wide text-bone/85">
                      {initials(post.authorName)}
                    </span>
                  </span>
                  <span className="truncate text-[14px] font-semibold text-bone">
                    @{post.authorHandle}
                  </span>
                </Link>
              </motion.div>

              {post.caption ? (
                <motion.div variants={item} className="max-w-[34ch]">
                  <p
                    ref={captionRef}
                    className={`text-[13.5px] leading-relaxed text-bone/95 ${
                      captionExpanded ? "" : "line-clamp-2"
                    }`}
                  >
                    {post.caption}
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
              ) : null}

              {post.brandTags.length > 0 && (
                <motion.div
                  variants={item}
                  className="flex flex-wrap gap-x-1.5 gap-y-1"
                >
                  {post.brandTags.map((b) => (
                    <span
                      key={b}
                      className="border border-bone/20 px-2.5 py-1 text-[11px] font-medium text-bone/70"
                    >
                      #{b}
                    </span>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* toast éphémère (confirmation signalement) */}
            <AnimatePresence></AnimatePresence>

            {/* barre de progression — même rythme que les looks */}
            <div className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-bone/10">
              <motion.div
                key={`${post.id}-${active}`}
                className="h-full bg-bone"
                initial={{ width: 0 }}
                animate={{ width: active ? "100%" : 0 }}
                transition={{ duration: active ? 13 : 0.25, ease: "linear" }}
              />
            </div>
          </>
        )}
      </motion.div>

      {taggedPieces.length > 0 && (
        <ShopTheLook
          products={taggedPieces}
          open={shopOpen}
          onOpenChange={setShopOpen}
          highlightId={null}
          variant="drawer"
        />
      )}

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetLabel={`Publication de @${post.authorHandle}`}
      />
    </section>
  );
}
