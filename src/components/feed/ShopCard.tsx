/* eslint-disable @next/next/no-img-element */
"use client";

import { useId, useState } from "react";
import { useStore } from "@/lib/store";
import { announce } from "@/lib/announce";
import { euro, compact, gradientFor, initials } from "@/lib/utils";
import { imgItem } from "@/lib/img";
import type { DisplayItem } from "../ui/ProductCard";
import { Button } from "../ui/Button";
import { Heart, Bookmark, Share, Bag } from "../chrome/icons";
import { RailAction, shareOrCopy } from "./RailAction";

/**
 * Full-screen shoppable product card — the Vinted-in-TikTok side of the feed.
 * Same immersive format as a look (snap, full-bleed), but the content is a
 * single catalog piece: photo, price, size, condition, seller, buy CTA.
 * Accepte aussi les annonces membres (item.image + item.member) : photo réelle,
 * CTA « Contacter » au lieu d'un checkout, badge « Vendu » quand c'est parti.
 */
export function ShopCard({
  item,
  index,
  total,
}: {
  item: DisplayItem;
  index: number;
  /** Nombre de pièces du fil (aria-setsize). */
  total: number;
}) {
  const { isLiked, toggleLike, isSaved, toggleSave, isSold } = useStore();
  const liked = isLiked(item.id);
  const saved = isSaved(item.id);
  const sold = isSold(item.id);
  const [imgOk, setImgOk] = useState(true);
  // Photo réelle (annonce membre) prioritaire ; sinon visuel par seed.
  const src = item.image ?? imgItem(item.id);
  const off = item.originalEUR
    ? Math.round((1 - item.priceEUR / item.originalEUR) * 100)
    : null;
  const brandId = useId();
  const nameId = useId();

  /* Partager : la fiche de la pièce ; une annonce membre n'a pas encore de
     page à elle (pas de SSG en beta), on partage le profil du vendeur, où
     elle figure dans « En vente ». */
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    const path = item.member
      ? `/membre/${encodeURIComponent(item.seller)}`
      : `/article/${item.id}`;
    const outcome = await shareOrCopy({
      title: `${item.brand} — ${item.name}`,
      url: new URL(path, window.location.origin).href,
    });
    if (outcome === "copied") {
      announce("Lien copié");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (outcome === "failed") {
      announce("Impossible de partager ce lien", "assertive");
    }
  };

  return (
    <article
      data-index={index}
      aria-labelledby={`${brandId} ${nameId}`}
      aria-posinset={index + 1}
      aria-setsize={total}
      className="feed-snap relative flex h-[100dvh] w-full items-center justify-center md:py-[3vh]"
    >
      <div
        className="relative z-10 h-full w-full overflow-hidden bg-black md:h-full md:max-h-[880px] md:w-[min(94vw,468px)] md:rounded-stage md:ring-1 md:ring-bone/10 md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.85)]"
        style={{ background: gradientFor(item.seed) }}
      >
        {/* gradient + monogram fallback (shows if the photo is missing) */}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="font-display text-[7rem] font-black text-bone/10">
            {initials(item.brand)}
          </span>
        </span>

        {imgOk && (
          <>
            {/* blurred fill so portrait product shots aren't hard-cropped */}
            <img
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-[0.4]"
            />
            <img
              src={src}
              alt={`${item.brand} — ${item.name}`}
              draggable={false}
              loading={index < 2 ? "eager" : "lazy"}
              onError={() => setImgOk(false)}
              className="absolute inset-0 size-full object-contain"
            />
          </>
        )}

        {/* legibility scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

        {/* état vendu — overlay sombre sur la photo, sous l'info et le rail */}
        {sold && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/55">
            <span className="border border-bone/60 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-widest text-bone">
              Vendu
            </span>
          </div>
        )}

        {/* discount badge — top-left, under the top bar */}
        {off !== null && off > 0 && !sold && (
          <span
            style={{ top: "calc(env(safe-area-inset-top) + 6.75rem)" }}
            className="absolute left-[max(1rem,env(safe-area-inset-left))] z-20 bg-bone px-2.5 py-1 text-[11px] font-bold tracking-wide text-ink md:left-4"
          >
            −{off}%
          </span>
        )}

        {/* action rail — like / save / share (resserré sur écran court) */}
        <div
          style={{ bottom: "calc(var(--tabbar-clearance) + 9rem)" }}
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex flex-col items-center gap-5 md:!bottom-40 md:right-3 [@media(max-height:700px)]:gap-2"
        >
          <RailAction
            label={compact(item.likes + (liked ? 1 : 0))}
            hint="j'aime"
            onClick={() => toggleLike(item.id)}
            pressed={liked}
          >
            <Heart filled={liked} className="size-6 text-bone" />
          </RailAction>
          {/* libellé fixe : l'état passe par aria-pressed et le signet plein */}
          <RailAction
            label="Garder"
            onClick={() => toggleSave(item.id)}
            pressed={saved}
          >
            <Bookmark filled={saved} className="size-6 text-bone" />
          </RailAction>
          <RailAction
            label={copied ? "Copié" : "Partager"}
            onClick={() => void onShare()}
          >
            <Share className="size-[22px] text-bone" />
          </RailAction>
        </div>

        {/* bottom info + buy CTA */}
        <div
          style={{ paddingBottom: "calc(var(--tabbar-clearance) + 1rem)" }}
          className="absolute inset-x-0 bottom-0 z-20 space-y-2.5 p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[calc(5rem+env(safe-area-inset-right))] md:!pb-9 md:pl-4 md:pr-20"
        >
          <p id={brandId} className="text-[12px] text-bone/75">
            {item.brand}
          </p>
          {/* un titre par écran du fil Pièces (rotor VoiceOver) */}
          <h2
            id={nameId}
            className="font-display max-w-[24ch] text-[16px] font-semibold leading-snug tracking-tight text-bone"
          >
            {item.name}
          </h2>

          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-black tracking-mega text-bone">
              {euro(item.priceEUR)}
            </span>
            {item.originalEUR && (
              <span className="text-[13px] text-ash line-through">
                {euro(item.originalEUR)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-bone/25 px-2.5 py-1 text-[11px] font-medium text-bone/80">
              Taille {item.size}
            </span>
            <span className="border border-bone/25 px-2.5 py-1 text-[11px] font-medium text-bone/80">
              {item.condition}
            </span>
          </div>

          <p className="text-[11px] text-ash">
            Vendu par <span className="text-bone/80">@{item.seller}</span> ·
            protection acheteur incluse
          </p>

          <div className="flex items-center gap-2 pt-1">
            {sold ? (
              <Button disabled>
                <Bag className="size-4" /> Vendu
              </Button>
            ) : item.member ? (
              /* Annonce membre : pas de page détail/checkout en beta. */
              <Button href={`/messages?item=${item.id}`}>Contacter</Button>
            ) : (
              <Button href={`/checkout/${item.id}`}>
                <Bag className="size-4" /> Acheter
              </Button>
            )}
            {/* lot 0 : le bouton était MORT (aucun lien) — branché vers la
                conversation vendeur, même destination que la fiche pièce */}
            {!sold && (
              <Button variant="outline" href={`/messages?item=${item.id}`}>
                Faire une offre
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
