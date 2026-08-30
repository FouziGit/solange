"use client";

import { Button } from "@/components/ui/Button";
/* ============================================================
   SOLANGE — profil public /membre/[handle]
   Membre réel : api.profile(handle) (annonces + posts serveur).
   Handles du mock (créateurs du feed + vitrine) : profil DÉMO
   construit depuis src/lib/mock, avec bandeau explicite.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { api, type PublicProfile } from "@/lib/api";
import { catalog, looks, me } from "@/lib/mock";
import { imgItem, imgLook } from "@/lib/img";
import { EASE, compact, euro, gradientFor, initials } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { Photo } from "@/components/ui/Photo";
import { Verified } from "@/components/chrome/icons";

/* ---------- affichage normalisé (serveur ou démo) ---------- */

type Tile = {
  id: string;
  brand: string;
  name: string;
  priceEUR: number;
  size: string;
  image?: string;
  /** Vendu d'après la donnée source ; complété par isSold() au rendu. */
  soldBase: boolean;
};

type PostTile = {
  id: string;
  image?: string;
  caption: string;
  seed: string;
};

type Profile = {
  demo: boolean;
  dmOpen: boolean;
  handle: string;
  name: string;
  seed: string;
  verified: boolean;
  followers: number | null;
  products: Tile[];
  posts: PostTile[];
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "notfound" }
  | { kind: "ready"; profile: Profile };

/** Créateurs du mock (feed) + vitrine `me` — inexistants côté serveur. */
function demoCreator(handle: string) {
  if (handle === me.handle)
    return {
      name: me.name,
      seed: me.seed,
      followers: me.followers,
      verified: me.verified === true,
    };
  const c = looks.find((l) => l.creator.handle === handle)?.creator;
  return c
    ? {
        name: c.name,
        seed: c.seed,
        followers: c.followers,
        verified: c.verified === true,
      }
    : null;
}

function demoProfile(handle: string): Profile | null {
  const c = demoCreator(handle);
  if (!c) return null;
  return {
    demo: true,
    dmOpen: false,
    handle,
    name: c.name,
    seed: c.seed,
    verified: c.verified,
    followers: c.followers,
    products: catalog
      .filter((it) => it.seller === handle)
      .map((it) => ({
        id: it.id,
        brand: it.brand,
        name: it.name,
        priceEUR: it.priceEUR,
        size: it.size,
        image: imgItem(it.id),
        soldBase: false,
      })),
    posts: looks
      .filter((l) => l.creator.handle === handle)
      .map((l) => ({
        id: l.id,
        image: l.gallery?.[0] ?? imgLook(l.id),
        caption: l.caption,
        seed: l.seed,
      })),
  };
}

function serverProfile(data: PublicProfile): Profile {
  return {
    demo: false,
    dmOpen: data.dmOpen ?? true,
    handle: data.user.handle,
    name: data.user.name || data.user.handle,
    seed: data.user.handle,
    verified: false,
    followers: null,
    products: data.products.map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      priceEUR: p.priceEUR,
      size: p.size,
      image: p.images[0],
      soldBase: p.status === "sold",
    })),
    posts: data.posts.map((p) => ({
      id: p.id,
      image: p.gallery[0],
      caption: p.caption,
      seed: `post-${p.id}`,
    })),
  };
}

/* ---------- tuiles ---------- */

function ProductTile({
  tile,
  sold,
  index,
}: {
  tile: Tile;
  sold: boolean;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: 0.5,
        ease: EASE.luxe,
        delay: Math.min(index * 0.04, 0.3),
      }}
    >
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-bone/10"
        style={{ background: gradientFor(tile.id) }}
      >
        {tile.image && <Photo src={tile.image} alt={tile.name} />}
        {sold && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55">
            <span className="border border-bone/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-bone">
              Vendu
            </span>
          </span>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="overline text-[9px] text-ash">{tile.brand}</p>
        <p className="mt-0.5 truncate text-sm text-bone">{tile.name}</p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-display text-[15px] font-bold text-bone">
            {euro(tile.priceEUR)}
          </span>
          {tile.size && (
            <span className="text-[11px] text-ash">T. {tile.size}</span>
          )}
        </div>
      </div>

      {sold ? (
        <span
          aria-disabled="true"
          className="mt-2 flex min-h-11 cursor-not-allowed items-center justify-center border border-bone/15 text-[12px] font-semibold text-bone/40"
        >
          Vendu
        </span>
      ) : (
        <Link
          href={`/messages?item=${tile.id}`}
          data-cursor="link"
          aria-label={`Contacter le vendeur — ${tile.brand} ${tile.name}`}
          className="mt-2 flex min-h-11 items-center justify-center border border-bone/30 text-[12px] font-semibold text-bone transition-colors hover:bg-bone/10 active:scale-[0.98]"
        >
          Contacter
        </Link>
      )}
    </motion.article>
  );
}

function PostThumb({ post, index }: { post: PostTile; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{
        duration: 0.5,
        ease: EASE.luxe,
        delay: Math.min(index * 0.04, 0.3),
      }}
      className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-bone/10"
      style={{ background: gradientFor(post.seed) }}
    >
      {post.image && <Photo src={post.image} alt="" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
        <p className="line-clamp-2 text-[11px] leading-snug text-bone/85">
          {post.caption}
        </p>
      </div>
    </motion.div>
  );
}

/* ---------- page ---------- */

export default function MembrePage() {
  const params = useParams<{ handle: string }>();
  const raw = typeof params?.handle === "string" ? params.handle : "";
  let handle = raw;
  try {
    handle = decodeURIComponent(raw);
  } catch {
    // paramètre mal encodé — on garde la valeur brute
  }

  const { user, isFollowing, toggleFollow, isBlocked, toggleBlock, isSold } =
    useStore();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.profile(handle);
    if (res.ok) {
      setState({ kind: "ready", profile: serverProfile(res.data) });
      return;
    }
    // Handles du mock : jamais côté serveur → profil de démonstration.
    const demo = demoProfile(handle);
    if (demo) {
      setState({ kind: "ready", profile: demo });
      return;
    }
    if (res.status === 404) setState({ kind: "notfound" });
    else setState({ kind: "error", message: res.error });
  }, [handle]);

  useEffect(() => {
    // chargement différé d'un tick — pas de setState synchrone en effet
    queueMicrotask(() => {
      if (!handle) setState({ kind: "notfound" });
      else void load();
    });
  }, [handle, load]);

  const following = isFollowing(handle);
  const blocked = isBlocked(handle);
  const isSelf = user !== null && user.handle === handle;

  const report = async () => {
    setMenuOpen(false);
    const reason = window.prompt(`Pourquoi signaler @${handle} ?`);
    if (!reason || !reason.trim()) return;
    const res = await api.report("user", handle, reason.trim());
    setReportMsg(
      res.ok
        ? "Signalement envoyé. Merci, notre équipe va examiner ce profil."
        : `Signalement impossible : ${res.error}`,
    );
  };

  return (
    <PageShell marginWord="Membre">
      {state.kind === "loading" && (
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
          <span className="size-20 animate-pulse rounded-full bg-bone/10" />
          <p className="text-sm text-ash">Chargement du profil…</p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
          <h1 className="font-editorial text-3xl font-semibold tracking-tight text-bone">
            Profil indisponible
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ash">
            {state.message}
          </p>
          <Button onClick={() => void load()} className="mt-8">
            Réessayer
          </Button>
        </div>
      )}

      {state.kind === "notfound" && (
        <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
          <span className="font-editorial text-[4.5rem] italic leading-none text-bone/85">
            @
          </span>
          <span className="mt-4 h-px w-12 bg-bone/25" />
          <h1 className="font-editorial mt-6 text-3xl font-semibold tracking-tight text-bone md:text-4xl">
            Profil introuvable
          </h1>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ash">
            Aucun membre ne répond au nom de{" "}
            <span className="text-bone">@{handle || "?"}</span>. Le compte a
            peut-être été supprimé, ou le lien est périmé.
          </p>
          <Link
            href="/decouvrir"
            data-cursor="link"
            className="mt-8 rounded-none bg-bone px-6 py-3 text-sm font-semibold text-ink transition-transform active:scale-95"
          >
            Découvrir la boutique
          </Link>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {/* bandeau démo */}
          {state.profile.demo && (
            <p className="mb-6 rounded-2xl border border-bone/12 bg-coal/60 px-4 py-3 text-[12.5px] leading-relaxed text-ash">
              <span className="font-semibold text-bone">
                Profil de démonstration
              </span>{" "}
              — ce créateur fait partie des données d&apos;exemple de la beta.
            </p>
          )}

          {/* hero */}
          <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
            <div className="relative">
              <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-bone/40 to-bone/10 blur-[2px]" />
              <span
                role="img"
                aria-label={state.profile.name}
                className="relative grid size-24 place-items-center rounded-full ring-2 ring-ink md:size-28"
                style={{ background: gradientFor(state.profile.seed) }}
              >
                <span className="font-display text-3xl font-bold tracking-wide text-bone/85 md:text-4xl">
                  {initials(state.profile.name || state.profile.handle)}
                </span>
              </span>
            </div>

            <div className="mt-4 md:ml-7 md:mt-0 md:flex-1">
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <h1 className="font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
                  {state.profile.name}
                </h1>
                {state.profile.verified && (
                  <Verified className="size-5 text-bone" />
                )}
              </div>
              <p className="mt-1 text-sm text-ash">
                @{state.profile.handle}
                {state.profile.followers !== null && (
                  <> · {compact(state.profile.followers)} abonnés</>
                )}
              </p>
              <p className="mt-2 text-[12px] text-ash">
                {state.profile.products.length} annonce
                {state.profile.products.length > 1 ? "s" : ""} ·{" "}
                {state.profile.posts.length} post
                {state.profile.posts.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2 md:mt-0">
              <button
                type="button"
                onClick={() => toggleFollow(handle)}
                disabled={isSelf}
                aria-pressed={following}
                data-cursor="link"
                className={`inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                  following
                    ? "border border-bone/25 text-bone"
                    : "bg-bone text-ink"
                }`}
              >
                {isSelf ? "C'est toi" : following ? "Suivi" : "Suivre"}
              </button>

              {/* DM — seulement si le membre accepte les messages directs */}
              {!isSelf && state.profile.dmOpen && (
                <Link
                  href={`/messages?to=${encodeURIComponent(handle)}`}
                  data-cursor="link"
                  className="inline-flex min-h-11 items-center rounded-full border border-bone/25 px-5 text-sm font-semibold text-bone transition-colors hover:border-bone/60"
                >
                  Écrire
                </Link>
              )}

              {/* ⋯ — signaler / bloquer */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Plus d'options"
                  data-cursor="link"
                  className="grid size-11 place-items-center rounded-full border border-bone/20 text-bone transition-colors hover:bg-bone/10"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ⋯
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Fermer le menu"
                      onClick={() => setMenuOpen(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-2xl border border-bone/12 bg-coal/95 py-1 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-md"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void report()}
                        className="flex min-h-11 w-full items-center px-4 text-left text-[13px] text-bone transition-colors hover:bg-bone/10"
                      >
                        Signaler le profil
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          toggleBlock(handle);
                          setMenuOpen(false);
                        }}
                        className="flex min-h-11 w-full items-center px-4 text-left text-[13px] text-bone transition-colors hover:bg-bone/10"
                      >
                        {blocked
                          ? `Débloquer @${state.profile.handle}`
                          : `Bloquer @${state.profile.handle}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* retour de signalement */}
          {reportMsg && (
            <p className="mt-4 text-center text-[12.5px] text-ash md:text-left">
              {reportMsg}
            </p>
          )}

          {blocked ? (
            /* membre bloqué : contenus masqués */
            <div className="mx-auto mt-10 max-w-md rounded-3xl border border-bone/12 bg-coal/60 p-6 text-center md:mx-0">
              <p className="font-editorial text-2xl font-semibold text-bone">
                Membre bloqué
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ash">
                Ses annonces et ses posts sont masqués partout sur SOLANGE.
              </p>
              <button
                type="button"
                onClick={() => toggleBlock(handle)}
                data-cursor="link"
                className="mt-5 inline-flex min-h-11 items-center rounded-full border border-bone/25 px-5 text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
              >
                Débloquer @{state.profile.handle}
              </button>
            </div>
          ) : (
            <>
              {/* annonces */}
              <section className="mt-10" aria-label="Annonces en vente">
                <p className="overline mb-3 text-[9px] text-ash">
                  En vente · {state.profile.products.length}
                </p>
                {state.profile.products.length === 0 ? (
                  <p className="rounded-2xl border border-bone/10 px-4 py-6 text-center text-[13px] text-ash">
                    Aucune annonce en vente pour le moment.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {state.profile.products.map((t, i) => (
                      <ProductTile
                        key={t.id}
                        tile={t}
                        sold={t.soldBase || isSold(t.id)}
                        index={i}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* posts */}
              <section className="mt-10" aria-label="Posts publiés">
                <p className="overline mb-3 text-[9px] text-ash">
                  Posts · {state.profile.posts.length}
                </p>
                {state.profile.posts.length === 0 ? (
                  <p className="rounded-2xl border border-bone/10 px-4 py-6 text-center text-[13px] text-ash">
                    Aucun post publié pour le moment.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {state.profile.posts.map((p, i) => (
                      <PostThumb key={p.id} post={p} index={i} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
