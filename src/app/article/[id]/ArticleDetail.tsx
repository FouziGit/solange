"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { imgItem } from "@/lib/img";
import { track } from "@/lib/track";
import { useStore } from "@/lib/store";
import { usePaymentsMode } from "@/lib/use-payments-mode";
import { Avatar } from "@/components/chrome/Avatar";
import { Button } from "@/components/ui/Button";
import { Etiquette } from "@/components/ui/Etiquette";
import { LuxeMedia } from "@/components/ui/LuxeMedia";
import { Photo } from "@/components/ui/Photo";
import { ProductCard, type DisplayItem } from "@/components/ui/ProductCard";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { Bookmark, Send } from "@/components/chrome/icons";

export function ArticleDetail({
  item,
  similar,
}: {
  item: DisplayItem;
  similar: CatalogItem[];
}) {
  const { isSaved, toggleSave, isSold } = useStore();
  // « simulé » seulement quand le serveur l'a confirmé (paiement réel en prod)
  const payments = usePaymentsMode();
  const [reportOpen, setReportOpen] = useState(false);
  const saved = isSaved(item.id);
  const sold = item.soldBase || isSold(item.id);
  // ce que la barre d'achat dit à la place du bouton
  const etat = sold
    ? "Vendue"
    : item.reserved
      ? "Paiement en cours"
      : item.mine
        ? "Ta pièce"
        : null;

  // deterministic thumbnail variants off the base seed
  const thumbs = [`${item.seed}-a`, `${item.seed}-b`];
  // vraies photos de l'annonce : la vignette touchée passe en grand
  const photos = item.images ?? [];
  const [shown, setShown] = useState(0);

  /* Écrites une fois, rendues deux fois : sous la photo dès lg, sous
     l'étiquette avant (la photo et son étiquette restent collées). */
  const vignettes =
    photos.length > 1 ? (
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setShown(i)}
            aria-label={`Photo ${i + 1} sur ${photos.length}`}
            aria-pressed={shown === i}
            data-cursor="link"
            className={`relative aspect-square overflow-hidden ring-1 transition ${
              shown === i
                ? "ring-bone"
                : "opacity-60 ring-bone/10 hover:opacity-100"
            }`}
          >
            <Photo src={src} />
          </button>
        ))}
      </div>
    ) : (
      <div className="mt-3 grid grid-cols-2 gap-3">
        {thumbs.map((t) => (
          <div
            key={t}
            className="relative aspect-[4/3] overflow-hidden ring-1 ring-bone/10"
          >
            <LuxeMedia
              seed={t}
              brand={item.brand}
              small
              className="theme-dark"
            />
          </div>
        ))}
      </div>
    );

  const details = [
    ["Catégorie", item.category],
    ["Couleur", item.color],
    ["Matière", item.material],
    ["En ligne", item.postedAgo],
  ].filter(([, v]) => v);

  return (
    <div>
      {/* two-column: media left, details right */}
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        {/* LEFT — media. Opacité seule, comme la colonne de droite : la photo
            ne glisse pas sous le fil de son étiquette. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ni arrondi ni contour : le fil de l'étiquette touche son bord */}
          <div className="relative aspect-[3/4] overflow-hidden">
            {/* theme-dark : le filigrane reste clair sur le fond sombre */}
            <LuxeMedia
              seed={item.seed}
              brand={item.brand}
              image={photos[shown] ?? imgItem(item.id)}
              eager
              className="theme-dark"
            />
            <button
              type="button"
              onClick={() => toggleSave(item.id)}
              aria-label={`Garder ${item.brand} ${item.name}`}
              aria-pressed={saved}
              data-cursor="link"
              className="glass absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
            >
              <Bookmark filled={saved} className="size-5" />
            </button>
          </div>
          <div className="hidden lg:block">{vignettes}</div>
        </motion.div>

        {/* RIGHT — details. Opacité seule : un transform sur cet ancêtre
            calerait la barre d'achat fixed sur la colonne, pas sur l'écran. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        >
          <Etiquette variant="fiche" item={item} sold={sold} />

          {/* barre d'achat : collée en bas sur téléphone (à la place de la
              barre d'onglets), sous l'étiquette dès md. Marges de PageShell :
              étiquette et bouton s'alignent sur la photo. Moitié-moitié :
              plus étroite, l'étiquette couperait son prix. */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex gap-2 border-t border-line bg-[var(--background)] pt-2.5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:mt-4 md:border-0 md:bg-transparent md:p-0">
            {/* aucun prix pour une pièce vendue */}
            {!sold && (
              <Etiquette
                variant="barre"
                item={item}
                className="min-w-0 flex-1 md:hidden"
              />
            )}
            {etat ? (
              <p className="flex min-h-[52px] flex-1 items-center justify-center border border-line px-3 text-center text-[13.5px] font-semibold text-ash">
                {etat}
              </p>
            ) : (
              <Button
                href={`/checkout/${item.id}`}
                onClick={() =>
                  track("checkout_start", {
                    id: item.id,
                    brand: item.brand,
                    priceEUR: item.priceEUR,
                  })
                }
                className="min-h-[52px] flex-1"
              >
                Acheter
              </Button>
            )}
          </div>

          <div className="lg:hidden">{vignettes}</div>

          {/* seller row — handle réel cliquable → profil public, et un seul
              lien pour lui écrire */}
          <div className="mt-6 flex flex-col gap-2 border border-line p-2 sm:flex-row sm:items-center">
            <Link
              href={`/membre/${encodeURIComponent(item.seller)}`}
              data-cursor="link"
              aria-label={`Voir le profil de @${item.seller}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-1 transition-colors hover:bg-bone/10"
            >
              {/* annonce d'un membre : son compte et sa photo ; pièce de
                  démo : le monogramme du vendeur, comme avant */}
              <Avatar
                name={item.seller}
                {...(item.sellerId
                  ? { seed: item.sellerId, src: item.sellerAvatar ?? null }
                  : { seed: item.seller })}
                className="size-11 shrink-0 text-2xl ring-1 ring-bone/15"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-bone">
                  @{item.seller}
                </span>
                <span className="block text-[11px] text-ash">
                  Voir le profil
                </span>
              </span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              href={`/messages?item=${item.id}`}
              className="min-w-0"
            >
              <Send className="size-3.5 shrink-0" />
              <span className="truncate">Écrire à @{item.seller}</span>
            </Button>
          </div>

          {item.description && (
            <div className="mt-7">
              <p className="etiquette text-[11px] text-ash">Description</p>
              <div className="mt-2.5 space-y-3 text-[14px] leading-relaxed text-bone/85">
                {item.description.split("\n\n").map((para) => (
                  <p key={para.slice(0, 24)}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* marque, taille et état ne sont dits que par l'étiquette */}
          {details.length > 0 && (
            <dl className="mt-6 divide-y divide-bone/10 border-y border-bone/10 text-[13px]">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ash">{k}</dt>
                  <dd className="text-right text-bone">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-6 text-[13px] leading-relaxed text-ash">
            {payments.ready && !payments.live
              ? "Protection acheteur (démo) — paiement simulé, aucune transaction réelle."
              : payments.live
                ? "Protection acheteur — le paiement se fait par carte, via Stripe."
                : "Protection acheteur."}
          </p>

          {/* Lot 4 : les annonces étaient le SEUL contenu non signalable
              de l'app (messages, membres, posts et fils l'étaient). */}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            data-cursor="link"
            className="mt-4 min-h-11 text-[12.5px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Signaler cette pièce
          </button>
        </motion.div>
      </div>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="product"
        targetId={item.id}
        targetLabel={`${item.brand} ${item.name}`}
      />

      {/* similar */}
      {similar.length > 0 && (
        <section className="mt-16 md:mt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone md:text-4xl">
              Pièces similaires
            </h2>
            <span className="hidden text-sm text-ash md:block">
              {similar.length} pièce{similar.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {similar.map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
