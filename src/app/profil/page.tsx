"use client";

import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PageShell } from "@/components/ui/PageShell";
import { ProductCard } from "@/components/ui/ProductCard";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/chrome/Avatar";
import { AnimatePresence } from "motion/react";
import { invite, looks, me } from "@/lib/mock";
import { forSale, liked } from "@/lib/data";
import { EASE, compact, euro, gradientFor, initials } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { api, type ApiOrder, type ApiProduct } from "@/lib/api";
import {
  STATUS_LABEL,
  normalizeStatus,
  type OrderStatus,
} from "@/lib/order-state";
import { imgItem } from "@/lib/img";
import {
  Verified,
  Star,
  Pin,
  Crown,
  Share,
  Check,
} from "@/components/chrome/icons";

const tabs = [
  { key: "vente", label: "À vendre" },
  { key: "looks", label: "Looks" },
  { key: "aimes", label: "Aimés" },
] as const;

/** Ligne commande/vente — Link vers /commande/[id] quand un suivi existe. */
function Row({
  href,
  ariaLabel,
  children,
}: {
  href?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const cls =
    "glass flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors";
  if (!href) return <div className={cls}>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-cursor="link"
      className={`${cls} hover:bg-bone/[0.08]`}
    >
      {children}
    </Link>
  );
}

/** Libellé de statut — commandes démo locales sans statut = « Payée ». */
function statusLabel(status?: string): string {
  return STATUS_LABEL[normalizeStatus(status) as OrderStatus] ?? "Payée";
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-lg font-bold text-bone tabular-nums">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-ash">
        {label}
      </div>
    </div>
  );
}

function ReferralCard() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context / denied) — stay silent,
      // the code is still visible for manual copy.
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.4, ease: EASE.luxe }}
      className="overflow-hidden"
      aria-label="Parrainage"
    >
      <div className="mt-6 rounded-3xl border border-bone/12 bg-coal/60 p-5 md:max-w-md">
        <p className="overline text-[11px] text-ash">Parrainage</p>
        <p className="mt-1 font-editorial text-2xl font-semibold text-bone">
          Invite, gagne.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ash">
          {invite.reward}.
        </p>

        {/* code + copy */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-bone/[0.05] p-1.5 pl-4">
          <span className="flex-1 select-all font-display text-[15px] font-bold tracking-[0.12em] text-bone">
            {invite.code}
          </span>
          <Button
            size="sm"
            onClick={copy}
            aria-label="Copier le code de parrainage"
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copié
              </>
            ) : (
              "Copier le code"
            )}
          </Button>
        </div>

        {/* reward ladder with pips */}
        <ol className="mt-5 space-y-3">
          {invite.steps.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-bone/25 font-display text-[11px] font-bold text-bone/80"
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-bone">
                  {step.label}
                </span>
                <span className="block text-[12px] leading-relaxed text-ash">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-5 border-t border-bone/10 pt-3 text-[12px] text-ash">
          <span className="font-semibold text-bone tabular-nums">
            {invite.invited}
          </span>{" "}
          ami{invite.invited > 1 ? "s" : ""} déjà parrainé
          {invite.invited > 1 ? "s" : ""}.
        </p>
      </div>
    </motion.section>
  );
}

export default function ProfilPage() {
  const [tab, setTab] = useState<string>("vente");
  const [referral, setReferral] = useState(false);
  const { orders, user, authReady, signOut, savedItems, refreshProducts } =
    useStore();
  const saleItems = forSale();
  const likedItems = liked();
  const isGuest = authReady && user === null;

  // Mes annonces (toutes, y compris vendues/retirées) + mes ventes — serveur.
  const [myProds, setMyProds] = useState<ApiProduct[]>([]);
  const [sales, setSales] = useState<ApiOrder[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  // suppression de compte — confirmation en 2 temps
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // réglage : accepter les messages directs
  const [dmOpen, setDmOpen] = useState<boolean | null>(null);
  const [dmSaving, setDmSaving] = useState(false);
  const toggleDm = async () => {
    if (dmOpen === null || dmSaving) return;
    setDmSaving(true);
    const res = await api.saveSettings(!dmOpen);
    setDmSaving(false);
    if (res.ok) setDmOpen(res.data.dmOpen);
  };

  const loadMine = useCallback(async () => {
    setMineLoading(true);
    const [p, s, st] = await Promise.all([
      api.myProducts(),
      api.sales(),
      api.getSettings(),
    ]);
    if (p.ok) setMyProds(p.data.products);
    if (s.ok) setSales(s.data.orders);
    if (st.ok) setDmOpen(st.data.dmOpen);
    setMineLoading(false);
  }, []);

  useEffect(() => {
    // chargement/reset différé d'un tick — pas de setState synchrone en effet
    queueMicrotask(() => {
      if (user) void loadMine();
      else {
        setMyProds([]);
        setSales([]);
      }
    });
  }, [user, loadMine]);

  const withdraw = async (id: string) => {
    setWithdrawing(id);
    const res = await api.withdrawProduct(id);
    setWithdrawing(null);
    if (res.ok) {
      await Promise.all([loadMine(), refreshProducts()]);
    }
  };

  const myListings = myProds.length;

  const reconnect = () => {
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {
      /* stockage indisponible — la reconnexion suffit */
    }
    location.reload();
  };

  const disconnect = async () => {
    await signOut();
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {
      /* stockage indisponible — la reconnexion suffit */
    }
    location.assign("/");
  };

  const destroyAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await api.deleteAccount();
    if (!res.ok) {
      setDeleting(false);
      setDeleteError(res.error);
      return;
    }
    try {
      localStorage.removeItem("solange:onboarded");
    } catch {
      /* stockage indisponible — la reconnexion suffit */
    }
    location.assign("/");
  };

  return (
    <PageShell>
      {/* hero */}
      <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
        <div className="relative">
          <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-bone/40 to-bone/10 blur-[2px]" />
          {user ? (
            /* membre connecté : monogramme réel, pas de fausse photo */
            <span
              role="img"
              aria-label={user.name}
              className="relative grid size-28 place-items-center rounded-full ring-2 ring-ink md:size-32"
              style={{ background: gradientFor(user.handle) }}
            >
              <span className="font-display text-4xl font-bold tracking-wide text-bone/85">
                {initials(user.name || user.handle)}
              </span>
            </span>
          ) : (
            <Avatar
              name={me.name}
              seed={me.seed}
              className="relative size-28 text-6xl ring-2 ring-ink md:size-32"
            />
          )}
        </div>

        <div className="mt-4 md:ml-7 md:mt-0 md:flex-1">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <h1 className="font-display text-4xl font-bold tracking-tight text-bone md:text-5xl">
              {user ? user.name : me.name}
            </h1>
            {!user && me.verified && <Verified className="size-5 text-bone" />}
          </div>
          <p className="mt-1 text-sm text-ash">
            @{user ? user.handle : me.handle}
          </p>
          {user ? (
            <p className="mt-2 text-[13px] text-ash">{user.email}</p>
          ) : (
            <>
              <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-bone/85 md:mx-0">
                {me.bio}
              </p>
              <div className="mt-3 flex items-center justify-center gap-3 text-[12px] text-ash md:justify-start">
                <span className="inline-flex items-center gap-1">
                  <Pin className="size-3.5" /> {me.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star filled className="size-3.5 text-bone" /> {me.rating}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 md:mt-0">
          <Button href="/premium">
            <Crown className="size-4" /> Premium
          </Button>
          <button
            type="button"
            onClick={() => setReferral((r) => !r)}
            aria-expanded={referral}
            aria-label="Inviter des amis"
            data-cursor="link"
            className={`grid size-10 place-items-center rounded-full border transition-colors ${
              referral
                ? "border-bone bg-bone text-ink"
                : "border-bone/20 text-bone hover:bg-bone/10"
            }`}
          >
            <Share className="size-4" />
          </button>
        </div>
      </div>

      {/* referral / invite — toggled by the Share button above */}
      <AnimatePresence initial={false}>
        {referral && <ReferralCard />}
      </AnimatePresence>

      {/* stats — réelles (store) pour un membre connecté, mock sinon */}
      <div className="mt-8 flex items-center justify-around rounded-2xl border border-bone/10 py-4 md:max-w-md">
        {user ? (
          <>
            <Stat value={String(orders.length)} label="Commandes" />
            <span className="h-8 w-px bg-bone/10" />
            <Stat value={String(savedItems().length)} label="Favoris" />
            <span className="h-8 w-px bg-bone/10" />
            <Stat value={String(myListings)} label="Annonces" />
          </>
        ) : (
          <>
            <Stat value={compact(me.followers)} label="Abonnés" />
            <span className="h-8 w-px bg-bone/10" />
            <Stat value={compact(me.following)} label="Abonnements" />
            <span className="h-8 w-px bg-bone/10" />
            <Stat value={String(me.sales)} label="Ventes" />
          </>
        )}
      </div>

      {/* invité : encart mode démo + reconnexion */}
      {isGuest && (
        <div className="mt-6 rounded-2xl border border-bone/12 bg-coal/60 p-5 md:max-w-md">
          <p className="overline text-[11px] text-ash">Mode démo</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-bone/85">
            Connecte-toi pour garder tes achats et tes favoris.
          </p>
          <Button onClick={reconnect} className="mt-4 w-full md:w-auto">
            Se connecter / créer un compte
          </Button>
        </div>
      )}

      {/* mes commandes — populated by the checkout flow */}
      {orders.length > 0 && (
        <div className="mt-8 md:max-w-md">
          <p className="overline mb-3 text-[11px] text-ash">
            Mes commandes · {orders.length}
          </p>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              // commande serveur → sa page de suivi ; commande démo → carte inerte
              <Row
                key={o.id}
                href={o.status ? `/commande/${o.id}` : undefined}
                ariaLabel={`Commande ${o.item.name} — ${statusLabel(o.status)}`}
              >
                <span
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
                  style={{ background: gradientFor(o.item.id) }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgItem(o.item.id)}
                    alt={o.item.name}
                    className="size-full object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ash">{o.item.brand}</p>
                  <p className="font-display truncate text-[14px] font-semibold tracking-tight text-bone">
                    {o.item.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ash">
                    {o.id} ·{" "}
                    {/^\d{4}$/.test(o.last4)
                      ? `carte •••• ${o.last4}`
                      : "paiement simulé (démo)"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-display text-sm font-bold tracking-tight text-bone">
                    {euro(o.total)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bone/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-bone/80">
                    <Check className="size-2.5" /> {statusLabel(o.status)}
                  </span>
                </div>
              </Row>
            ))}
          </div>
        </div>
      )}

      {/* sections serveur en cours de chargement : squelette fidèle plutôt
          qu'une apparition d'un coup (matrice des états, profil/chargement) */}
      {user && mineLoading && (
        <div aria-busy="true" className="mt-8 flex flex-col gap-2 md:max-w-md">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* mes annonces — pièces déposées par le membre (serveur) */}
      {user && myProds.length > 0 && (
        <div className="mt-8 md:max-w-md">
          <p className="overline mb-3 text-[11px] text-ash">
            Mes annonces · {myProds.length}
          </p>
          <div className="flex flex-col gap-2">
            {myProds.map((p) => (
              <div
                key={p.id}
                className="glass flex items-center gap-3 rounded-2xl p-2.5"
              >
                <span
                  className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
                  style={{ background: gradientFor(p.id) }}
                >
                  {p.images[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="size-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ash">{p.brand}</p>
                  <p className="font-display truncate text-[14px] font-semibold tracking-tight text-bone">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ash">
                    {euro(p.priceEUR)} · {p.size}
                  </p>
                </div>
                {p.status === "available" ? (
                  <button
                    type="button"
                    onClick={() => void withdraw(p.id)}
                    disabled={withdrawing === p.id}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-bone/20 px-3.5 text-[12px] font-medium text-bone/80 transition-colors hover:border-bone/50 hover:text-bone disabled:opacity-40"
                  >
                    {withdrawing === p.id ? "Retrait…" : "Retirer"}
                  </button>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-bone/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-bone/70">
                    {p.status === "sold" ? "Vendue" : "Retirée"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* mes ventes — commandes reçues sur mes annonces (serveur) */}
      {user && sales.length > 0 && (
        <div className="mt-8 md:max-w-md">
          <p className="overline mb-3 text-[11px] text-ash">
            Mes ventes · {sales.length}
          </p>
          <div className="flex flex-col gap-2">
            {sales.map((s) => (
              <Row
                key={s.id}
                href={`/commande/${s.id}`}
                ariaLabel={`Vente ${s.name} — ${statusLabel(s.status)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ash">{s.brand}</p>
                  <p className="font-display truncate text-[14px] font-semibold tracking-tight text-bone">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ash">
                    Achetée par @{s.buyerHandle ?? "membre"} ·{" "}
                    {new Date(s.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                    <span className="text-bone/80">
                      {statusLabel(s.status)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-display text-sm font-bold tracking-tight text-bone">
                    {s.netSellerEUR != null
                      ? euro(s.netSellerEUR)
                      : euro(s.priceEUR)}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-ash">
                    net vendeur
                  </span>
                </div>
              </Row>
            ))}
          </div>
        </div>
      )}

      {/* tabs */}
      <div
        role="tablist"
        aria-label="Sections du profil"
        className="mt-9 flex gap-1 border-b border-bone/10"
      >
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className="relative px-4 pb-3 text-sm font-medium transition-colors"
            >
              <span className={on ? "text-bone" : "text-ash hover:text-bone"}>
                {t.label}
              </span>
              {on && (
                <motion.span
                  layoutId="profil-tab"
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-bone"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* content */}
      <div className="mt-6">
        {tab === "looks" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {looks.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  ease: EASE.luxe,
                  delay: Math.min(i * 0.05, 0.3),
                }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-bone/10"
                style={{ background: gradientFor(l.seed) }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(60% 50% at 50% 30%, rgba(255,255,255,0.12), transparent 62%)",
                  }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-editorial text-3xl font-semibold text-bone/85 transition-transform duration-700 group-hover:scale-110">
                    {l.title}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3 text-[11px] text-bone/80">
                  <span>@{l.creator.handle}</span>
                  <span className="tabular-nums">♡ {compact(l.likes)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {(tab === "vente" ? saleItems : likedItems).map((it, i) => (
              <ProductCard key={it.id} item={it} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* footer line — mock uniquement (pas de fausses ventes pour un membre réel) */}
      {!user && (
        <p className="mt-10 text-center text-xs text-ash">
          Membre SOLANGE depuis 2026 · {euro(me.sales * 86)} de ventes cumulées
        </p>
      )}

      {/* réglages — messages directs */}
      {user && dmOpen !== null && (
        <div className="mt-8 rounded-2xl border border-bone/10 p-4 md:max-w-md">
          <p className="overline mb-2 text-[11px] text-ash">Réglages</p>
          <button
            type="button"
            onClick={() => void toggleDm()}
            disabled={dmSaving}
            role="switch"
            aria-checked={dmOpen}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-bone">
                Autoriser les messages directs
              </span>
              <span className="block text-[11.5px] text-ash">
                Les membres peuvent t&apos;écrire sans passer par une annonce.
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                dmOpen ? "bg-bone" : "bg-bone/20"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full transition-all ${
                  dmOpen ? "left-[22px] bg-ink" : "left-0.5 bg-bone/70"
                }`}
              />
            </span>
          </button>
        </div>
      )}

      <div className="mt-6 mb-2 flex flex-col items-center gap-1 text-center">
        {user && (
          <>
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex min-h-11 items-center px-4 text-[12px] text-ash/70 underline-offset-4 transition-colors hover:text-bone hover:underline"
            >
              Déconnexion
            </button>

            {/* zone danger — suppression du compte, confirmation en 2 temps */}
            {!deleteArmed ? (
              <button
                type="button"
                onClick={() => setDeleteArmed(true)}
                className="inline-flex min-h-11 items-center px-4 text-[11px] text-danger/80 underline-offset-4 transition-colors hover:text-danger hover:underline"
              >
                Supprimer mon compte
              </button>
            ) : (
              <div className="mt-2 w-full max-w-sm rounded-2xl border border-danger/30 bg-danger/10 p-4">
                <p className="text-[13px] leading-relaxed text-bone/85">
                  Sûr ? Toutes tes données seront effacées.
                </p>
                {deleteError && (
                  <p role="alert" className="mt-2 text-[12px] text-danger">
                    {deleteError}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button
                    variant="danger"
                    onClick={() => void destroyAccount()}
                    disabled={deleting}
                  >
                    {deleting ? "Suppression…" : "Supprimer mon compte"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteArmed(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="inline-flex min-h-11 items-center rounded-full border border-bone/20 px-4 text-[13px] text-bone/80 transition-colors hover:border-bone/50 hover:text-bone disabled:opacity-40"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex items-center gap-1">
          <Link
            href="/mentions-legales"
            className="inline-flex min-h-11 items-center px-2 text-[11px] text-ash/60 underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Mentions légales
          </Link>
          <span aria-hidden="true" className="text-[11px] text-ash/40">
            ·
          </span>
          <Link
            href="/confidentialite"
            className="inline-flex min-h-11 items-center px-2 text-[11px] text-ash/60 underline-offset-4 transition-colors hover:text-bone hover:underline"
          >
            Confidentialité
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
