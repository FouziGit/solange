"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { CatalogItem } from "@/lib/mock";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { imgItem } from "@/lib/img";
import { commission, euro, gradientFor } from "@/lib/utils";
import {
  ArrowLeft,
  Lock,
  Card,
  Check,
  Bag,
  Verified,
} from "@/components/chrome/icons";

type Step = "form" | "processing" | "done";

/** Digits only, grouped 4-by-4, max 16 digits (19 chars w/ spaces). */
function formatCard(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)} / ${d.slice(2)}`;
}

export function CheckoutView({ item }: { item: CatalogItem }) {
  const { addOrder } = useStore();

  // Prefilled with the Stripe test card so the demo flows in one tap.
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12 / 34");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("Nouh Benzidane");
  const [step, setStep] = useState<Step>("form");
  const [orderId, setOrderId] = useState("");

  const price = item.priceEUR;
  const protection = Math.round(price * 0.05) + 0.7; // Vinted-style buyer protection
  const shipping = 4.9;
  const total = Math.round((price + protection + shipping) * 100) / 100;
  const { rate, net } = commission(price); // Stripe Connect split
  const last4 = card.replace(/\D/g, "").slice(-4) || "4242";

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== "form") return;
    setStep("processing");
    const id =
      "SLG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    // Simulated Stripe payment intent latency.
    setTimeout(() => {
      setOrderId(id);
      addOrder({
        id,
        item,
        protection,
        shipping,
        total,
        last4,
        date: new Date().toISOString(),
      });
      setStep("done");
    }, 1700);
  };

  /* ---------------- success ---------------- */
  if (step === "done") {
    return (
      <PageShell>
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-bone text-ink"
          >
            <Check className="size-8" />
          </motion.div>

          <h1 className="font-display mt-6 text-center text-3xl font-bold uppercase tracking-tight text-bone">
            Paiement réussi
          </h1>
          <p className="mt-2 text-center text-[13px] text-ash">
            Commande <span className="text-bone">{orderId}</span> · payée{" "}
            {euro(total)} · carte •••• {last4}
          </p>

          <div className="glass mt-7 flex items-center gap-3 rounded-2xl p-3">
            <span
              className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
              style={{ background: gradientFor(item.id) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgItem(item.id)}
                alt={item.name}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="overline text-[9px] text-ash">{item.brand}</p>
              <p className="font-display truncate text-[15px] font-semibold tracking-tight text-bone">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ash">
                Taille {item.size} · {item.condition}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-bone/12 bg-bone/[0.03] px-4 py-3 text-[12.5px] text-ash">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bone/10">
              <Bag className="size-4 text-bone" />
            </span>
            Le vendeur <span className="text-bone">@{item.seller}</span> a été
            notifié — expédition sous 48h.
          </div>

          <div className="mt-7 flex flex-col gap-3">
            <Link
              href="/profil"
              className="rounded-full bg-bone py-3.5 text-center text-sm font-semibold text-ink transition-transform active:scale-95"
            >
              Voir mes commandes
            </Link>
            <Link
              href="/"
              className="glass rounded-full py-3.5 text-center text-sm font-semibold text-bone transition-colors hover:bg-bone/10"
            >
              Retour au feed
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---------------- checkout form ---------------- */
  return (
    <PageShell>
      <Link
        href={`/article/${item.id}`}
        data-cursor="link"
        aria-label="Retour"
        className="glass mb-5 inline-grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90"
      >
        <ArrowLeft className="size-5" />
      </Link>

      <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-bone">
        Paiement
      </h1>

      {/* Test-mode banner — honest: nothing real is charged. */}
      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-bone/20 bg-bone/[0.04] px-3.5 py-2.5">
        <span className="rounded-md bg-bone px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
          Test
        </span>
        <p className="text-[11.5px] leading-tight text-ash">
          Simulation <span className="text-bone">Stripe Connect</span> — aucun
          paiement réel n&apos;est effectué.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
        {/* ---- order summary ---- */}
        <section className="order-2 lg:order-1">
          <div className="glass flex items-center gap-3 rounded-2xl p-3">
            <span
              className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-bone/10"
              style={{ background: gradientFor(item.id) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgItem(item.id)}
                alt={item.name}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="overline text-[9px] text-ash">{item.brand}</p>
              <p className="font-display truncate text-[16px] font-semibold tracking-tight text-bone">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ash">
                Taille {item.size} · {item.condition}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-ash">
                Vendu par <span className="text-bone">@{item.seller}</span>
                <Verified className="size-3 text-bone" />
              </p>
            </div>
          </div>

          {/* breakdown */}
          <dl className="mt-4 space-y-2 rounded-2xl border border-bone/10 p-4 text-[13px]">
            <Row label="Article">{euro(price)}</Row>
            <Row label="Protection acheteur">{euro(protection)}</Row>
            <Row label="Livraison suivie">{euro(shipping)}</Row>
            <div className="my-1 h-px bg-bone/10" />
            <div className="flex items-center justify-between">
              <dt className="font-semibold text-bone">Total</dt>
              <dd className="font-display text-xl font-bold tracking-tight text-bone">
                {euro(total)}
              </dd>
            </div>
          </dl>

          {/* Stripe Connect split */}
          <div className="mt-3 rounded-2xl border border-bone/10 bg-bone/[0.02] p-4">
            <p className="overline mb-2 text-[9px] text-ash">
              Répartition · Stripe Connect
            </p>
            <Row label={`Le vendeur reçoit`}>{euro(net)}</Row>
            <Row label={`Commission SOLANGE (${Math.round(rate * 100)}%)`}>
              {euro(price - net)}
            </Row>
          </div>
        </section>

        {/* ---- payment card ---- */}
        <section className="order-1 lg:order-2">
          <form
            onSubmit={pay}
            className="rounded-3xl border border-bone/12 bg-coal/70 p-5 backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-bone">
                <Card className="size-4" /> Carte bancaire
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ash">
                via Stripe
              </span>
            </div>

            <Field label="Numéro de carte">
              <div className="relative">
                <input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={card}
                  onChange={(e) => setCard(formatCard(e.target.value))}
                  placeholder="1234 1234 1234 1234"
                  className="field pr-14"
                  aria-label="Numéro de carte"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-wide text-bone/70">
                  {card.startsWith("4") ? "VISA" : "CARTE"}
                </span>
              </div>
            </Field>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Expiration">
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={exp}
                  onChange={(e) => setExp(formatExpiry(e.target.value))}
                  placeholder="MM / AA"
                  className="field"
                  aria-label="Date d'expiration"
                />
              </Field>
              <Field label="CVC">
                <input
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvc}
                  onChange={(e) =>
                    setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="123"
                  className="field"
                  aria-label="Cryptogramme CVC"
                />
              </Field>
            </div>

            <Field label="Nom sur la carte" className="mt-3">
              <input
                autoComplete="cc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prénom Nom"
                className="field"
                aria-label="Nom sur la carte"
              />
            </Field>

            <button
              type="submit"
              disabled={step === "processing"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-bone py-3.5 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-70"
            >
              <AnimatePresence mode="wait" initial={false}>
                {step === "processing" ? (
                  <motion.span
                    key="proc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                    Paiement en cours…
                  </motion.span>
                ) : (
                  <motion.span
                    key="pay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Lock className="size-4" /> Payer {euro(total)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ash">
              <Lock className="size-3" /> Paiement chiffré · protection acheteur
              incluse
            </p>
          </form>
        </section>
      </div>
    </PageShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ash">{label}</dt>
      <dd className="tabular-nums text-bone/90">{children}</dd>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="overline mb-1.5 block text-[9px] text-ash">{label}</span>
      {children}
    </label>
  );
}
