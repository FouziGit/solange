"use client";

/* ============================================================
   SOLANGE — /commande/[id] (lot 1)
   La commande vue par ses DEUX parties : frise de statut, adresse
   de livraison (vendeur), actions selon le rôle (expédier, annuler,
   bien reçu, signaler), historique complet. Le serveur décide de
   tout (order-state) — l'écran n'affiche que ce qui est permis.
   Rendu client assumé (D-017) : données derrière cookie httpOnly,
   UN fetch, squelette DA, zéro cascade.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type ApiOrder } from "@/lib/api";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { euro } from "@/lib/utils";
import { STATUS_LABEL, TIMELINE, type OrderStatus } from "@/lib/order-state";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Chip } from "@/components/ui/Chip";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { Check, Pin, Send } from "@/components/chrome/icons";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "notfound" }
  | { kind: "ready"; order: ApiOrder };

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};
const when = (t: number) => new Date(t).toLocaleDateString("fr-FR", DATE_FMT);

/** Frise payée → expédiée → reçue → terminée. */
function Timeline({ status }: { status: OrderStatus }) {
  const idx = TIMELINE.indexOf(status);
  const stopped = status === "annulee" || status === "litige";
  return (
    <ol
      className="mt-5 flex items-start"
      aria-label="Avancement de la commande"
    >
      {TIMELINE.map((s, i) => {
        const on = !stopped && idx >= i;
        return (
          <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="flex w-full items-center">
              <span
                className={`h-px flex-1 ${i === 0 ? "opacity-0" : on ? "bg-bone" : "bg-bone/15"}`}
              />
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                  on
                    ? "border-bone bg-bone text-ink"
                    : "border-bone/25 text-transparent"
                }`}
              >
                <Check className="size-3" />
              </span>
              <span
                className={`h-px flex-1 ${i === TIMELINE.length - 1 ? "opacity-0" : !stopped && idx > i ? "bg-bone" : "bg-bone/15"}`}
              />
            </span>
            <span
              className={`text-[11px] ${on ? "font-semibold text-bone" : "text-ash"}`}
            >
              {STATUS_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function CommandePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { user, authReady } = useStore();

  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // sheets + confirmations
  const [shipOpen, setShipOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<
    "non_recue" | "non_conforme"
  >("non_recue");
  const [disputeNote, setDisputeNote] = useState("");
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.orderById(id);
    if (res.ok) setState({ kind: "ready", order: res.data.order });
    else if (res.status === 404) setState({ kind: "notfound" });
    else setState({ kind: "error", message: res.error });
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!id) setState({ kind: "notfound" });
      else if (authReady && !user) setState({ kind: "notfound" });
      else if (user) void load();
    });
  }, [id, user, authReady, load]);

  const transition = async (
    p: Parameters<typeof api.orderTransition>[0],
    event: string,
  ) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const res = await api.orderTransition(p);
    setBusy(false);
    if (res.ok) {
      track(event, { id: p.id });
      setShipOpen(false);
      setDisputeOpen(false);
      setCancelArmed(false);
      setState({ kind: "ready", order: res.data.order });
    } else {
      setActionError(res.error);
      // 409 = l'état a bougé entre-temps : on recharge la vérité serveur
      if (res.status === 409) void load();
    }
  };

  return (
    <PageShell marginWord="Commande">
      <PageHeader back="/profil" eyebrow="Suivi" title="Commande" />

      {state.kind === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-3 md:max-w-md">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {state.kind === "notfound" && (
        <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
          <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone">
            Commande introuvable
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ash">
            {user
              ? "Elle n'existe pas, ou elle ne t'appartient pas."
              : "Connecte-toi pour voir tes commandes."}
          </p>
          <Button href="/profil" className="mt-8">
            Aller au profil
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
          <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone">
            Commande indisponible
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ash">
            {state.message}
          </p>
          <Button onClick={() => void load()} className="mt-8">
            Réessayer
          </Button>
        </div>
      )}

      {state.kind === "ready" &&
        (() => {
          const o = state.order;
          const status = o.status as OrderStatus;
          const seller = o.role === "seller";
          const seed = !o.sellerId;
          const counterpart = seller
            ? `@${o.buyerHandle ?? "membre"}`
            : `@${o.sellerHandle}`;

          const copyAddress = async () => {
            if (!o.address) return;
            try {
              await navigator.clipboard.writeText(
                `${o.address.name}\n${o.address.line}\n${o.address.postal} ${o.address.city}`,
              );
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* presse-papier indisponible — l'adresse reste lisible */
            }
          };

          return (
            <div className="md:max-w-md">
              {/* pièce + montant */}
              <div className="glass flex items-center gap-3 rounded-2xl p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ash">{o.brand}</p>
                  <p className="font-display truncate text-[15px] font-semibold tracking-tight text-bone">
                    {o.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ash">
                    {o.id} · {seller ? "vendue à" : "achetée à"} {counterpart}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold tracking-tight text-bone">
                    {euro(seller ? (o.netSellerEUR ?? o.priceEUR) : o.totalEUR)}
                  </p>
                  <p className="text-[11px] text-ash">
                    {seller ? "net vendeur" : "total payé"}
                  </p>
                </div>
              </div>

              {/* statut — annoncé aux lecteurs d'écran à chaque changement */}
              <p aria-live="polite" className="mt-5 text-[13px] text-bone">
                Statut :{" "}
                <span className="font-semibold">{STATUS_LABEL[status]}</span>
                {o.shipment?.tracking && (
                  <span className="text-ash">
                    {" "}
                    · suivi {o.shipment.tracking}
                  </span>
                )}
              </p>

              {status === "annulee" && (
                <p className="mt-2 border border-bone/15 px-3.5 py-3 text-[13px] text-ash">
                  Commande annulée
                  {o.cancelReason ? ` — ${o.cancelReason}` : ""}. La pièce est
                  remise en vente.
                </p>
              )}
              {status === "litige" && (
                <p className="mt-2 border border-danger/60 px-3.5 py-3 text-[13px] text-bone/85">
                  Problème signalé (
                  {o.dispute?.reason === "non_conforme"
                    ? "pièce non conforme"
                    : "pièce non reçue"}
                  ). L&apos;équipe tranche — la commande est gelée d&apos;ici
                  là.
                </p>
              )}
              {status !== "annulee" && status !== "litige" && (
                <Timeline status={status} />
              )}

              {seed && (
                <p className="mt-4 text-[12px] text-ash">
                  Pièce du catalogue de démonstration — pas d&apos;expédition
                  réelle sur cette commande.
                </p>
              )}

              {/* adresse de livraison — le vendeur en a besoin, il peut la copier */}
              {o.address && (
                <div className="mt-6 border border-bone/15 p-4">
                  <p className="overline text-[11px] text-ash">
                    Adresse de livraison
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-bone">
                    {o.address.name}
                    <br />
                    {o.address.line}
                    <br />
                    {o.address.postal} {o.address.city}
                  </p>
                  {seller && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyAddress}
                      className="mt-3"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" /> Copiée
                        </>
                      ) : (
                        "Copier l'adresse"
                      )}
                    </Button>
                  )}
                </div>
              )}
              {!o.address && o.shippingLabel && (
                <p className="mt-4 flex items-start gap-1.5 text-[12.5px] text-ash">
                  <Pin className="mt-0.5 size-3.5 shrink-0" />
                  {o.shippingLabel}
                </p>
              )}

              {actionError && (
                <p role="alert" className="mt-4 text-[13px] text-bone/85">
                  {actionError}
                </p>
              )}

              {/* actions par rôle — le serveur revalide tout */}
              {!seed && (
                <div className="mt-6 flex flex-col gap-2.5">
                  {seller && status === "payee" && (
                    <>
                      <Button
                        size="lg"
                        onClick={() => setShipOpen(true)}
                        disabled={busy}
                      >
                        J&apos;ai expédié
                      </Button>
                      {!cancelArmed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelArmed(true)}
                          className="self-start"
                        >
                          Annuler la vente
                        </Button>
                      ) : (
                        <div className="border border-danger/60 p-4">
                          <FieldLabel>Motif de l&apos;annulation</FieldLabel>
                          <input
                            value={cancelNote}
                            onChange={(e) => setCancelNote(e.target.value)}
                            placeholder="Ex. pièce abîmée au stockage"
                            className="field w-full"
                          />
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={busy || !cancelNote.trim()}
                              onClick={() =>
                                void transition(
                                  {
                                    id: o.id,
                                    action: "cancel",
                                    note: cancelNote.trim(),
                                  },
                                  "order_cancel",
                                )
                              }
                            >
                              {busy ? "Annulation…" : "Confirmer l'annulation"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelArmed(false)}
                            >
                              Garder la vente
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!seller && status === "expediee" && (
                    <>
                      <Button
                        size="lg"
                        disabled={busy}
                        onClick={() =>
                          void transition(
                            { id: o.id, action: "receive" },
                            "order_receive",
                          )
                        }
                      >
                        {busy ? "Un instant…" : "Bien reçu"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisputeOpen(true)}
                        className="self-start"
                      >
                        Signaler un problème
                      </Button>
                    </>
                  )}
                  {!seller && status === "recue" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisputeOpen(true)}
                      className="self-start"
                    >
                      Signaler un problème
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    href={
                      seller
                        ? `/messages?to=${encodeURIComponent(o.buyerHandle ?? "")}`
                        : `/messages?item=${encodeURIComponent(o.productId)}`
                    }
                  >
                    <Send className="size-4" />
                    {seller ? "Écrire à l'acheteur" : "Écrire au vendeur"}
                  </Button>
                </div>
              )}

              {/* montants */}
              <dl className="mt-6 space-y-2 rounded-2xl border border-bone/10 p-4 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ash">Article</dt>
                  <dd className="text-bone">{euro(o.priceEUR)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Protection acheteur</dt>
                  <dd className="text-bone">{euro(o.protectionEUR)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">
                    Livraison{o.shippingMethod ? ` · ${o.shippingMethod}` : ""}
                  </dt>
                  <dd className="text-bone">{euro(o.shippingEUR)}</dd>
                </div>
                <div className="my-1 h-px bg-bone/10" />
                <div className="flex justify-between">
                  <dt className="font-semibold text-bone">Total</dt>
                  <dd className="font-display font-bold text-bone">
                    {euro(o.totalEUR)}
                  </dd>
                </div>
                {seller && o.netSellerEUR != null && (
                  <div className="flex justify-between">
                    <dt className="text-ash">Net vendeur</dt>
                    <dd className="font-semibold text-bone">
                      {euro(o.netSellerEUR)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* historique */}
              {o.history && o.history.length > 0 && (
                <div className="mt-6">
                  <p className="overline mb-3 text-[11px] text-ash">
                    Historique
                  </p>
                  <ol className="flex flex-col gap-2.5">
                    {[...o.history].reverse().map((h, i) => (
                      <li key={i} className="flex gap-3 text-[12.5px]">
                        <span className="w-24 shrink-0 text-ash">
                          {when(h.at)}
                        </span>
                        <span className="min-w-0 text-bone/85">
                          {STATUS_LABEL[h.to as OrderStatus] ?? h.to}
                          {h.note ? (
                            <span className="text-ash"> — {h.note}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* sheet expédition */}
              <Sheet
                open={shipOpen}
                onClose={() => setShipOpen(false)}
                eyebrow="Commande"
                title="Expédition"
              >
                <div className="flex flex-col gap-4 px-5 py-4 pb-8">
                  <div>
                    <FieldLabel>Transporteur (facultatif)</FieldLabel>
                    <input
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder={o.shippingMethod ?? "Mondial Relay"}
                      className="field w-full"
                    />
                  </div>
                  <div>
                    <FieldLabel>Numéro de suivi (facultatif)</FieldLabel>
                    <input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="Ex. 6A1234567890"
                      className="field w-full"
                    />
                  </div>
                  <Button
                    size="lg"
                    disabled={busy}
                    onClick={() =>
                      void transition(
                        {
                          id: o.id,
                          action: "ship",
                          carrier: carrier.trim() || o.shippingMethod,
                          tracking: tracking.trim() || undefined,
                        },
                        "order_ship",
                      )
                    }
                  >
                    {busy ? "Envoi…" : "Confirmer l'expédition"}
                  </Button>
                </div>
              </Sheet>

              {/* sheet litige */}
              <Sheet
                open={disputeOpen}
                onClose={() => setDisputeOpen(false)}
                eyebrow="Commande"
                title="Un problème ?"
              >
                <div className="flex flex-col gap-4 px-5 py-4 pb-8">
                  <div className="flex gap-2">
                    <Chip
                      active={disputeReason === "non_recue"}
                      onClick={() => setDisputeReason("non_recue")}
                    >
                      Non reçue
                    </Chip>
                    <Chip
                      active={disputeReason === "non_conforme"}
                      onClick={() => setDisputeReason("non_conforme")}
                    >
                      Non conforme
                    </Chip>
                  </div>
                  <div>
                    <FieldLabel>Précisions (facultatif)</FieldLabel>
                    <textarea
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      rows={3}
                      placeholder="Décris le problème"
                      className="field w-full resize-none"
                    />
                  </div>
                  <p className="text-[12px] leading-relaxed text-ash">
                    Le litige gèle la commande. L&apos;équipe lit les deux
                    parties et tranche.
                  </p>
                  <Button
                    variant="danger"
                    size="lg"
                    disabled={busy}
                    onClick={() =>
                      void transition(
                        {
                          id: o.id,
                          action: "dispute",
                          reason: disputeReason,
                          note: disputeNote.trim() || undefined,
                        },
                        "order_dispute",
                      )
                    }
                  >
                    {busy ? "Envoi…" : "Ouvrir un litige"}
                  </Button>
                </div>
              </Sheet>
            </div>
          );
        })()}
    </PageShell>
  );
}
