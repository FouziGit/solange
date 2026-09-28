"use client";

/* ============================================================
   SOLANGE — /commande/[id] (lot 1)
   La commande vue par ses DEUX parties : frise de statut, adresse
   de livraison (vendeur), actions selon le rôle (expédier, annuler,
   bien reçu, signaler), historique complet. Le serveur décide de
   tout (order-state) — l'écran n'affiche que ce qui est permis.
   Rendu client assumé (D-017) : données derrière cookie httpOnly,
   UN fetch, squelette DA, zéro cascade.
   D-037 : numéro de suivi obligatoire pour expédier, lien vers la page
   de suivi du transporteur, note « Versement » (vendeur) ou
   « Protection » (acheteur), colis perdu.
   ============================================================ */

import { useCallback, useEffect, useId, useState } from "react";
import { flushSync } from "react-dom";
import { useParams } from "next/navigation";
import { api, type ApiOrder } from "@/lib/api";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { announce } from "@/lib/announce";
import { euro } from "@/lib/utils";
import { STATUS_LABEL, TIMELINE, type OrderStatus } from "@/lib/order-state";
import { stepState } from "@/lib/order-display";
import {
  carrierOfOrder,
  isPackageSize,
  packageSize,
  validateTracking,
} from "@/lib/shipping";
import { payoutNote } from "@/lib/payout";
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

/** Frise payée → expédiée → reçue → terminée. L'étape en cours porte
    aria-current="step" ; franchie / à venir est dit en texte, pas
    seulement par le remplissage du cercle. */
function Timeline({ status }: { status: OrderStatus }) {
  return (
    <ol
      className="mt-5 flex items-start"
      aria-label="Avancement de la commande"
    >
      {TIMELINE.map((s, i) => {
        const step = stepState(status, s);
        const on = step !== "a_venir";
        return (
          <li
            key={s}
            aria-current={step === "actuelle" ? "step" : undefined}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
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
                className={`h-px flex-1 ${i === TIMELINE.length - 1 ? "opacity-0" : step === "franchie" ? "bg-bone" : "bg-bone/15"}`}
              />
            </span>
            <span
              className={`text-[11px] ${on ? "font-semibold text-bone" : "text-ash"}`}
            >
              {STATUS_LABEL[s]}
              {step === "franchie" && (
                <span className="sr-only"> (étape franchie)</span>
              )}
              {step === "a_venir" && (
                <span className="sr-only"> (à venir)</span>
              )}
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
  const [tracking, setTracking] = useState("");
  // suivi obligatoire : contrôlé ici avant l'appel, revalidé par le serveur
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<
    "non_recue" | "non_conforme"
  >("non_recue");
  const [disputeNote, setDisputeNote] = useState("");
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  // « Bien reçu » clôt la commande et ferme le litige : 2 temps
  const [receiveArmed, setReceiveArmed] = useState(false);
  // 2 minutes de relecture sans confirmation de la banque
  const [attenteLongue, setAttenteLongue] = useState(false);
  const [copied, setCopied] = useState(false);
  // champs reliés à leur étiquette (VoiceOver, Contrôle vocal)
  const uid = useId();

  /* Le bouton touché disparaît au profit de la confirmation (et
     inversement) : le focus va à ce qui le remplace, sinon il retombe
     sur <body> et VoiceOver repart du haut de la page. */
  const swapThenFocus = (update: () => void, targetId: string) => {
    flushSync(update);
    document.getElementById(targetId)?.focus();
  };

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.orderById(id);
    if (res.ok) setState({ kind: "ready", order: res.data.order });
    else if (res.status === 404) setState({ kind: "notfound" });
    else setState({ kind: "error", message: res.error });
  }, [id]);

  /* Retour de Stripe : l'acheteur arrive ici avant que la banque ait
     confirmé — c'est le webhook qui fait passer la commande à « payée »,
     pas la redirection. On relit donc la commande en silence toutes les
     3 secondes tant qu'elle est en attente, deux minutes au plus. */
  const enAttente =
    state.kind === "ready" && state.order.status === "en_attente";
  useEffect(() => {
    if (!enAttente) return;
    let essais = 0;
    const t = setInterval(async () => {
      essais++;
      const res = await api.orderById(id);
      if (res.ok) setState({ kind: "ready", order: res.data.order });
      const confirmee = res.ok && res.data.order.status !== "en_attente";
      if (essais >= 40 || confirmee) clearInterval(t);
      // la page promet de se mettre à jour : quand elle arrête, elle le dit
      if (essais >= 40 && !confirmee) setAttenteLongue(true);
    }, 3000);
    return () => clearInterval(t);
  }, [enAttente, id]);

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
      setReceiveArmed(false);
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

          const transporteur = carrierOfOrder(o);
          const suivi = o.shipment?.tracking;
          const note = payoutNote(
            { ...o, status },
            seller ? "seller" : "buyer",
          );

          const copyTracking = async () => {
            if (!suivi) return;
            try {
              await navigator.clipboard.writeText(suivi);
              setTrackingCopied(true);
              announce("Numéro copié");
              window.setTimeout(() => setTrackingCopied(false), 1800);
            } catch {
              /* presse-papier indisponible — le numéro reste lisible */
            }
          };

          /* Le numéro est contrôlé AVANT l'appel : une erreur de saisie se
             corrige sur place, focus rendu au champ qui la porte. */
          const confirmShip = () => {
            const v = validateTracking(tracking);
            if (!v.ok) {
              flushSync(() => setTrackingError(v.error));
              document.getElementById(`${uid}-suivi`)?.focus();
              return;
            }
            void transition(
              {
                id: o.id,
                action: "ship",
                // transporteur fixé par la commande (grille du port, CGV
                // art. 5, liens de suivi et de réclamation)
                carrier: o.shippingMethod,
                tracking: v.tracking,
              },
              "order_ship",
            );
          };

          const copyAddress = async () => {
            if (!o.address) return;
            try {
              await navigator.clipboard.writeText(
                `${o.address.name}\n${o.address.line}\n${o.address.postal} ${o.address.city}`,
              );
              setCopied(true);
              announce("Adresse copiée");
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

              {status === "en_attente" && (
                <>
                  <div
                    role="status"
                    className="mt-5 flex items-start gap-3 border border-bone/25 bg-bone/[0.05] px-3.5 py-3"
                  >
                    {!attenteLongue && (
                      <span className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-bone/30 border-t-bone" />
                    )}
                    <p className="text-[12.5px] leading-relaxed text-bone/85">
                      {attenteLongue
                        ? "Ta banque n'a pas encore confirmé le paiement. Cette page ne se met plus à jour seule : actualise-la dans un instant."
                        : "Ta banque confirme le paiement. Cela prend en général quelques secondes — cette page se met à jour toute seule."}
                    </p>
                  </div>
                  {attenteLongue && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAttenteLongue(false);
                        void load();
                      }}
                      className="mt-2.5"
                    >
                      Actualiser
                    </Button>
                  )}
                </>
              )}
              {status === "annulee" &&
                (o as { cancelReason?: string }).cancelReason?.startsWith(
                  "Paiement",
                ) && (
                  <p className="mt-5 border border-bone/15 px-3.5 py-3 text-[12.5px] leading-relaxed text-ash">
                    Le paiement n&apos;a pas abouti : aucune somme n&apos;a été
                    débitée, et la pièce est de nouveau disponible.
                  </p>
                )}

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

              {/* La page de suivi du transporteur ne se pré-remplit pas :
                  on ouvre la page officielle et on copie le numéro. */}
              {transporteur && suivi && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={transporteur.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center border border-bone/25 px-3.5 text-[12px] font-semibold text-bone transition-colors hover:border-bone/60"
                  >
                    Suivre sur {transporteur.name}
                    <span className="sr-only"> (nouvel onglet)</span>
                  </a>
                  <Button variant="outline" size="sm" onClick={copyTracking}>
                    {trackingCopied ? (
                      <>
                        <Check className="size-3.5" /> Numéro copié
                      </>
                    ) : (
                      "Copier le numéro"
                    )}
                  </Button>
                </div>
              )}

              {status === "annulee" && (
                <p className="mt-2 border border-bone/15 px-3.5 py-3 text-[13px] text-ash">
                  Commande annulée
                  {o.cancelReason ? ` — ${o.cancelReason}` : ""}.
                  {/* colis perdu : la pièce reste vendue (D-037) */}
                  {!o.lostParcel && " La pièce est remise en vente."}
                </p>
              )}
              {status === "annulee" && o.lostParcel && (
                <div className="mt-2 border border-bone/15 px-3.5 py-3 text-[13px] leading-relaxed text-bone/85">
                  {!seller ? (
                    <p>
                      Colis perdu : tu es intégralement remboursé (prix, frais
                      de service et port). Le délai d&apos;apparition dépend de
                      ta banque.
                    </p>
                  ) : transporteur ? (
                    <>
                      <p>
                        Colis déclaré perdu. Déclare la perte à{" "}
                        {transporteur.name}
                        {suivi ? (
                          <>
                            {" "}
                            avec ton numéro de suivi{" "}
                            <span className="font-semibold text-bone">
                              {suivi}
                            </span>
                          </>
                        ) : null}
                        &nbsp;:
                      </p>
                      <a
                        href={transporteur.claimUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex min-h-11 items-center border border-bone/25 px-3.5 text-[12px] font-semibold text-bone transition-colors hover:border-bone/60"
                      >
                        Service client {transporteur.name}
                        <span className="sr-only"> (nouvel onglet)</span>
                      </a>
                      <p className="mt-2.5 text-[12.5px] text-ash">
                        {transporteur.name} indemnise selon ses conditions (
                        {euro(transporteur.lossCompensationCents / 100)}{" "}
                        forfaitaires inclus dans son tarif).
                      </p>
                    </>
                  ) : (
                    <p>
                      Colis déclaré perdu. Déclare la perte au transporteur
                      {suivi ? ` avec ton numéro de suivi ${suivi}` : ""}
                      &nbsp;: il indemnise selon ses propres conditions.
                    </p>
                  )}
                </div>
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

              {/* versement (vendeur) ou protection (acheteur) — D-037 */}
              {note && (
                <div className="mt-5 border border-bone/15 px-3.5 py-3">
                  <p className="etiquette text-[11px] text-ash">
                    {seller ? "Versement" : "Protection"}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-bone/85">
                    {note}
                  </p>
                </div>
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
                  <p className="etiquette text-[11px] text-ash">
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

              {/* feuille ouverte : l'erreur s'affiche DANS la feuille, pas
                  derrière son voile */}
              {actionError && !shipOpen && !disputeOpen && (
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
                        onClick={() => {
                          setActionError(null);
                          setTrackingError(null);
                          setShipOpen(true);
                        }}
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
                          <FieldLabel htmlFor={`${uid}-annulation`}>
                            Motif de l&apos;annulation
                          </FieldLabel>
                          <input
                            id={`${uid}-annulation`}
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

                  {/* L'acheteur peut se raviser tant que rien n'est parti.
                      Le serveur autorise désormais cette transition
                      (order-state, rôle `buyer` depuis `payee`) ; sans ce
                      bouton, le droit existait sans exister. */}
                  {!seller && status === "payee" && (
                    <>
                      <p className="text-[13px] leading-relaxed text-ash">
                        Le vendeur n&apos;a pas encore expédié. Tu peux annuler.
                      </p>
                      {!cancelArmed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelArmed(true)}
                          className="self-start"
                        >
                          Annuler ma commande
                        </Button>
                      ) : (
                        <div className="border border-bone/15 p-3.5">
                          <p className="text-[13px] text-bone">
                            Annuler définitivement&nbsp;? La pièce repartira en
                            vente.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void transition(
                                  {
                                    id: o.id,
                                    action: "cancel",
                                    note: "Annulée par l'acheteur avant expédition",
                                  },
                                  "order_cancel_buyer",
                                )
                              }
                            >
                              {busy ? "Un instant…" : "Annuler"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelArmed(false)}
                            >
                              Garder ma commande
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* « Bien reçu » clôt la commande : plus de litige
                      possible ensuite. Un appui de trop ne doit pas coûter
                      la protection acheteur — confirmation en 2 temps. */}
                  {!seller && status === "expediee" && (
                    <>
                      {!receiveArmed ? (
                        <Button
                          id={`${uid}-recu`}
                          size="lg"
                          disabled={busy}
                          onClick={() =>
                            swapThenFocus(
                              () => setReceiveArmed(true),
                              `${uid}-recu-question`,
                            )
                          }
                        >
                          Bien reçu
                        </Button>
                      ) : (
                        <div className="border border-bone/25 p-4">
                          <p
                            id={`${uid}-recu-question`}
                            tabIndex={-1}
                            className="text-[13px] leading-relaxed text-bone"
                          >
                            Tu confirmes avoir reçu la pièce conforme&nbsp;? Tu
                            ne pourras plus ouvrir de litige.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void transition(
                                  { id: o.id, action: "receive" },
                                  "order_receive",
                                )
                              }
                            >
                              {busy ? "Un instant…" : "Confirmer la réception"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                swapThenFocus(
                                  () => setReceiveArmed(false),
                                  `${uid}-recu`,
                                )
                              }
                            >
                              Pas encore
                            </Button>
                          </div>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActionError(null);
                          setDisputeOpen(true);
                        }}
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
                      onClick={() => {
                        setActionError(null);
                        setDisputeOpen(true);
                      }}
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
                    {isPackageSize(o.packageSize)
                      ? ` · colis ${packageSize(o.packageSize).label}`
                      : ""}
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
                  <p className="etiquette mb-3 text-[11px] text-ash">
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
                onClose={() => {
                  setShipOpen(false);
                  setActionError(null);
                  setTrackingError(null);
                }}
                eyebrow="Commande"
                title="Expédition"
              >
                <div className="flex flex-col gap-4 px-5 py-4 pb-8">
                  {/* obligatoire (D-037) : sans numéro, pas d'expédition */}
                  <div>
                    <FieldLabel htmlFor={`${uid}-suivi`}>
                      Numéro de suivi
                      <span className="font-normal normal-case tracking-normal">
                        {" "}
                        · obligatoire
                      </span>
                    </FieldLabel>
                    <input
                      id={`${uid}-suivi`}
                      value={tracking}
                      onChange={(e) => {
                        setTracking(e.target.value);
                        if (trackingError) setTrackingError(null);
                      }}
                      placeholder="Ex. 12345678"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-required="true"
                      aria-invalid={trackingError ? true : undefined}
                      aria-describedby={
                        trackingError
                          ? `${uid}-suivi-aide ${uid}-suivi-erreur`
                          : `${uid}-suivi-aide`
                      }
                      className="field w-full"
                    />
                    <p
                      id={`${uid}-suivi-aide`}
                      className="mt-1.5 text-[12px] leading-relaxed text-ash"
                    >
                      {transporteur?.trackingHint ??
                        "Le numéro de suivi de ton étiquette"}
                    </p>
                    {trackingError && (
                      <p
                        id={`${uid}-suivi-erreur`}
                        role="alert"
                        className="mt-1.5 text-[12.5px] leading-relaxed text-bone"
                      >
                        {trackingError}
                      </p>
                    )}
                  </div>
                  {o.shippingMethod && (
                    <p className="text-[12.5px] leading-relaxed text-ash">
                      Transporteur :{" "}
                      <span className="text-bone">{o.shippingMethod}</span> — le
                      mode choisi par l&apos;acheteur, au prix payé.
                    </p>
                  )}
                  {actionError && (
                    <p
                      role="alert"
                      className="text-[12.5px] leading-relaxed text-bone"
                    >
                      {actionError}
                    </p>
                  )}
                  <Button size="lg" disabled={busy} onClick={confirmShip}>
                    {busy ? "Envoi…" : "Confirmer l'expédition"}
                  </Button>
                </div>
              </Sheet>

              {/* sheet litige */}
              <Sheet
                open={disputeOpen}
                onClose={() => {
                  setDisputeOpen(false);
                  setActionError(null);
                }}
                eyebrow="Commande"
                title="Un problème ?"
              >
                <div className="flex flex-col gap-4 px-5 py-4 pb-8">
                  {/* choix unique : radiogroup nommé, flèches entre motifs */}
                  <div>
                    <FieldLabel id={`${uid}-motif`}>Motif</FieldLabel>
                    <div
                      role="radiogroup"
                      aria-labelledby={`${uid}-motif`}
                      className="flex gap-2"
                    >
                      <Chip
                        radio
                        active={disputeReason === "non_recue"}
                        onClick={() => setDisputeReason("non_recue")}
                      >
                        Non reçue
                      </Chip>
                      <Chip
                        radio
                        active={disputeReason === "non_conforme"}
                        onClick={() => setDisputeReason("non_conforme")}
                      >
                        Non conforme
                      </Chip>
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-precisions`}>
                      Précisions (facultatif)
                    </FieldLabel>
                    <textarea
                      id={`${uid}-precisions`}
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
                  {actionError && (
                    <p
                      role="alert"
                      className="text-[12.5px] leading-relaxed text-bone"
                    >
                      {actionError}
                    </p>
                  )}
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
