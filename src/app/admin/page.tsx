"use client";

/* ============================================================
   SOLANGE — /admin (lot 4) : la file de modération.
   Route absente de toute navigation ; le serveur renvoie 404 à
   quiconque n'est pas admin (on ne confirme pas son existence).
   Pensée pour le pouce : on traite un signalement d'une main,
   dans le métro, sans quitter la file.
   D-037 : la part du vendeur attend la livraison sur son compte Stripe,
   qui ne garde les fonds que 90 jours. Litiges et contestations
   bancaires au-delà de J+80 : bandeau en tête. Colis perdu, versements
   à surveiller et relance manuelle du virement.
   ============================================================ */

import { useCallback, useEffect, useId, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  api,
  type ModAuditEntry,
  type ModDispute,
  type ModPayoutItem,
  type ModReportItem,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import { announce } from "@/lib/announce";
import { STATUS_LABEL } from "@/lib/order-state";
import {
  PAYOUT_DELAYS,
  payoutNote,
  type OrderPayout,
  type PayoutStatus,
} from "@/lib/payout";
import { carrierOfOrder } from "@/lib/shipping";
import {
  MOD_ACTION_LABEL,
  SUSPEND_DAYS,
  TARGET_LABEL,
  type ModAction,
  type ReportTargetType,
} from "@/lib/moderation";
import { modActionLabel, photoModAction } from "@/lib/member-display";
import { euro } from "@/lib/utils";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Photo } from "@/components/ui/Photo";

const when = (t: number) =>
  new Date(t).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Depuis combien de temps ça attend — l'urgence se lit d'un coup d'œil. */
function waiting(at: number): string {
  const d = Math.floor((Date.now() - at) / 86_400_000);
  if (d >= 1) return `depuis ${d} j`;
  const h = Math.floor((Date.now() - at) / 3_600_000);
  return h >= 1 ? `depuis ${h} h` : "à l'instant";
}

const DAY = 86_400_000;

/** Jours écoulés depuis `at`, à l'heure du chargement de la file. */
const daysSince = (now: number, at: number) => Math.floor((now - at) / DAY);

const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  en_attente_fonds: "en attente des fonds Stripe",
  envoye: "envoyé",
  simule: "simulé",
  erreur: "en échec",
};

type Decision = "cancel" | "close" | "return" | "lost";

const DECISION_DONE: Record<Decision, string> = {
  cancel: "Commande annulée : l'acheteur est remboursé.",
  close: "Litige clos : la vente tient.",
  return: "Commande renvoyée aux parties.",
  lost: "Colis perdu : l'acheteur est remboursé, la pièce n'est pas remise en vente.",
};

/** Mode de versement de la commande, envoyé par le serveur quand il est
    posé (absent du JSON : commande antérieure, pas de note vendeur). Un
    versement existant suffit aussi à le dire (D-037). */
function payoutModeOf(x: { payout?: OrderPayout }): unknown {
  if ("payoutMode" in x) return x.payoutMode;
  return x.payout ? "manual" : undefined;
}

/** Résultat d'une relance de versement, lu par l'admin. */
function payoutResult(p: OrderPayout | null): string {
  if (!p)
    return "Aucun versement lancé : commande hors périmètre (non terminée, antérieure au versement par commande, ou contestation en cours).";
  switch (p.status) {
    case "envoye":
      return "Virement envoyé.";
    case "simule":
      return "Virement simulé (démonstration).";
    case "en_attente_fonds":
      return "Fonds pas encore disponibles chez Stripe : nouvel essai automatique chaque jour.";
    case "erreur":
      return `Versement en échec : ${p.lastError ?? "erreur sans détail"}`;
  }
}

type Queue = "open" | "done" | "all";
type Load =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      items: ModReportItem[];
      disputes: ModDispute[];
      payouts: ModPayoutItem[];
      /** Heure du chargement : les âges (J+N) se lisent à cet instant. */
      now: number;
    };

export default function AdminPage() {
  const { authReady, user } = useStore();
  const [queue, setQueue] = useState<Queue>("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<ModAuditEntry[] | null>(null);

  // sheet d'action
  const [acting, setActing] = useState<{
    item: ModReportItem;
    action: ModAction;
  } | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState<number>(7);

  /* Décisions d'argent en deux temps (colis perdu, verser malgré une
     contestation) ; erreur et résultat affichés près de la commande. */
  const [lostArmed, setLostArmed] = useState<string | null>(null);
  const [overrideArmed, setOverrideArmed] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const uid = useId();

  /* Le bouton touché disparaît au profit de la confirmation (et
     inversement) : le focus va à ce qui le remplace. */
  const swapThenFocus = (update: () => void, targetId: string) => {
    flushSync(update);
    document.getElementById(targetId)?.focus();
  };

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.modQueue(queue);
    if (res.ok)
      setState({
        kind: "ready",
        items: res.data.items,
        disputes: res.data.disputes,
        payouts: res.data.payouts,
        now: Date.now(),
      });
    else if (res.status === 404 || res.status === 401)
      setState({ kind: "denied" });
    else setState({ kind: "error", message: res.error });
  }, [queue]);

  useEffect(() => {
    queueMicrotask(() => {
      if (authReady) void load();
    });
  }, [authReady, load]);

  const runAction = async (
    item: ModReportItem,
    action: ModAction,
    extra?: { note?: string; days?: number },
  ) => {
    setBusy(item.id);
    const res = await api.modAct({
      reportId: item.id,
      action,
      authorId: item.context?.authorId,
      note: extra?.note,
      days: extra?.days,
    });
    setBusy(null);
    setActing(null);
    setNote("");
    if (res.ok) void load();
  };

  const decideDispute = async (d: ModDispute, decision: Decision) => {
    if (busy) return;
    setBusy(d.id);
    setRowError(null);
    setFlash(null);
    const res = await api.modDispute(d.id, decision);
    setBusy(null);
    if (!res.ok) {
      setRowError({ id: d.id, message: res.error });
      announce(res.error, "assertive");
      return;
    }
    setLostArmed(null);
    setFlash(`${d.id} — ${DECISION_DONE[decision]}`);
    announce(DECISION_DONE[decision]);
    void load();
  };

  /* Même chemin que le cron (_shared/payout.mts). `override` : verser
     malgré une contestation bancaire en cours, décision explicite. */
  const retryPayout = async (p: ModPayoutItem, override: boolean) => {
    if (busy) return;
    setBusy(p.id);
    setRowError(null);
    setFlash(null);
    const res = await api.modRetryPayout(p.id, override);
    setBusy(null);
    if (!res.ok) {
      setRowError({ id: p.id, message: res.error });
      announce(res.error, "assertive");
      return;
    }
    setOverrideArmed(null);
    const text = payoutResult(res.data.payout);
    setFlash(`${p.id} — ${text}`);
    announce(text);
    void load();
  };

  /* — accès refusé : on n'explique rien de plus qu'une page inexistante — */
  if (state.kind === "denied" || (authReady && !user))
    return (
      <PageShell marginWord="Introuvable" className="grid place-items-center">
        <div className="flex max-w-md flex-col items-center text-center">
          <h1 className="font-editorial text-3xl font-semibold tracking-tight text-bone">
            Page introuvable
          </h1>
          <Button href="/" className="mt-8">
            Retour à l&apos;accueil
          </Button>
        </div>
      </PageShell>
    );

  const items =
    state.kind === "ready"
      ? state.items.filter(
          (i) => typeFilter === "all" || i.targetType === typeFilter,
        )
      : [];

  /* Litiges et contestations bancaires à J+80 ou plus après le paiement :
     Stripe ne garde les fonds du vendeur que 90 jours (D-037). */
  const lateAges = new Map<string, number>();
  if (state.kind === "ready") {
    const late = (id: string, at: number | undefined) => {
      if (at === undefined) return;
      const age = state.now - at;
      if (age >= PAYOUT_DELAYS.forceAfterPaidMs)
        lateAges.set(id, Math.max(age, lateAges.get(id) ?? 0));
    };
    for (const d of state.disputes) late(d.id, d.paidAt ?? d.createdAt);
    for (const p of state.payouts) if (p.bankDispute) late(p.id, p.paidAt);
  }
  const oldestLate = Math.max(0, ...lateAges.values());

  return (
    <PageShell marginWord="Modération">
      <PageHeader
        eyebrow="Réservé"
        title="Modération"
        subtitle="Signalements et litiges. Chaque action laisse une trace."
      />

      {/* ---- limite Stripe des 90 jours : rien ne passe avant ---- */}
      {lateAges.size > 0 && (
        <div
          role="alert"
          className="mb-6 border-2 border-danger bg-danger/10 p-4 md:max-w-2xl"
        >
          <p className="etiquette text-[11px] text-danger">
            {oldestLate >= PAYOUT_DELAYS.urgentAfterPaidMs
              ? "Urgent — limite Stripe de 90 jours"
              : "À trancher — limite Stripe de 90 jours"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-bone">
            {lateAges.size === 1
              ? "Un litige ou une contestation bancaire attend"
              : `${lateAges.size} litiges ou contestations bancaires attendent`}{" "}
            depuis plus de 80 jours après le paiement (jusqu&apos;à J+
            {Math.floor(oldestLate / DAY)}). Stripe ne garde les fonds du
            vendeur que 90 jours : tranche avant J+88.
          </p>
          <p className="mt-1.5 text-[12px] text-ash">
            {[...lateAges.keys()].join(" · ")}
          </p>
        </div>
      )}

      {/* résultat de la dernière décision (lu aussi par announce) */}
      {flash && (
        <p className="mb-6 border border-bone/15 px-3.5 py-3 text-[13px] leading-relaxed text-bone/85 md:max-w-2xl">
          {flash}
        </p>
      )}

      {/* filtres — au pouce, en haut */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["open", "À traiter"],
            ["done", "Traités"],
            ["all", "Tout"],
          ] as const
        ).map(([k, label]) => (
          <Chip key={k} active={queue === k} onClick={() => setQueue(k)}>
            {label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip
          active={typeFilter === "all"}
          onClick={() => setTypeFilter("all")}
        >
          Tous types
        </Chip>
        {(Object.keys(TARGET_LABEL) as ReportTargetType[]).map((t) => (
          <Chip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
          >
            {TARGET_LABEL[t]}
          </Chip>
        ))}
      </div>

      {state.kind === "loading" && (
        <div aria-busy="true" className="mt-6 flex flex-col gap-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-8 flex flex-col items-start gap-3 border border-bone/15 p-4">
          <p className="text-[13px] text-ash">{state.message}</p>
          <Button size="sm" onClick={() => void load()}>
            Réessayer
          </Button>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {/* ---- litiges de commande : les plus urgents ---- */}
          {state.disputes.length > 0 && (
            <section className="mt-8" aria-label="Litiges de commande">
              <p className="etiquette mb-3 text-[11px] text-danger">
                Litiges · {state.disputes.length}
              </p>
              <div className="flex flex-col gap-2">
                {state.disputes.map((d) => {
                  const age = daysSince(state.now, d.paidAt ?? d.createdAt);
                  const sellerNote = payoutNote(
                    {
                      status: "litige",
                      payoutMode: payoutModeOf(d),
                      payout: d.payout,
                      bankDispute: d.bankDispute,
                    },
                    "seller",
                  );
                  const nonRecue = d.dispute?.reason === "non_recue";
                  // commande ancienne (Chronopost, Pickup…) : pas de nom
                  const transporteur = carrierOfOrder(d);
                  return (
                    <div
                      key={d.id}
                      className="border border-danger/50 p-3.5 md:max-w-2xl"
                    >
                      <p className="font-display text-[14px] font-semibold text-bone">
                        {d.brand} — {d.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ash">
                        @{d.buyerHandle} conteste · vendu par @{d.sellerHandle}{" "}
                        · {euro(d.totalEUR)} ·{" "}
                        {waiting(d.dispute?.at ?? d.createdAt)}
                      </p>
                      <p className="mt-1 text-[12px] text-ash">
                        <span
                          className={
                            age * DAY >= PAYOUT_DELAYS.forceAfterPaidMs
                              ? "font-semibold text-danger"
                              : undefined
                          }
                        >
                          J+{age} depuis le paiement
                        </span>
                        {d.tracking
                          ? ` · suivi ${d.tracking}`
                          : " · aucun numéro de suivi"}
                      </p>
                      <p className="mt-2 text-[13px] text-bone/85">
                        {d.dispute?.reason === "non_conforme"
                          ? "Pièce non conforme"
                          : "Pièce non reçue"}
                        {d.dispute?.note ? ` — ${d.dispute.note}` : ""}
                      </p>
                      {sellerNote && (
                        <p className="mt-1.5 text-[12px] text-ash">
                          Vu par le vendeur : « {sellerNote} »
                        </p>
                      )}
                      {d.payout?.status === "envoye" && (
                        <p className="mt-1.5 text-[12px] text-danger">
                          Part déjà virée au vendeur : rembourser
                          l&apos;acheteur rendra son solde Stripe négatif.
                        </p>
                      )}
                      {d.bankDispute && (
                        <p className="mt-1.5 text-[12px] text-danger">
                          Contestation bancaire en cours depuis le{" "}
                          {when(d.bankDispute.at)}
                          {d.bankDispute.amount !== undefined
                            ? ` (${euro(d.bankDispute.amount / 100)})`
                            : ""}{" "}
                          : aucun virement au vendeur tant qu&apos;elle dure.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy === d.id}
                          onClick={() => void decideDispute(d, "cancel")}
                        >
                          Annuler la commande
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === d.id}
                          onClick={() => void decideDispute(d, "close")}
                        >
                          Clôturer (la vente tient)
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === d.id}
                          onClick={() => void decideDispute(d, "return")}
                        >
                          Renvoyer aux parties
                        </Button>
                        {/* colis perdu : seulement sur un litige « non reçu »,
                          en deux temps (remboursement intégral) */}
                        {nonRecue && lostArmed !== d.id && (
                          <Button
                            id={`${uid}-perdu-${d.id}`}
                            variant="danger"
                            size="sm"
                            disabled={busy === d.id}
                            onClick={() =>
                              swapThenFocus(
                                () => setLostArmed(d.id),
                                `${uid}-perdu-aide-${d.id}`,
                              )
                            }
                          >
                            Colis perdu — rembourser l&apos;acheteur
                          </Button>
                        )}
                      </div>
                      {nonRecue && lostArmed === d.id && (
                        <div className="mt-3 border border-danger/60 p-3.5">
                          <p
                            id={`${uid}-perdu-aide-${d.id}`}
                            tabIndex={-1}
                            className="text-[12.5px] leading-relaxed text-bone/85"
                          >
                            Avant de trancher, demande au vendeur d&apos;ouvrir
                            une réclamation auprès{" "}
                            {transporteur
                              ? `de ${transporteur.name}`
                              : "du transporteur"}{" "}
                            : son indemnisation suppose une perte confirmée par
                            le transporteur.
                          </p>
                          <p className="mt-2 text-[12px] leading-relaxed text-ash">
                            L&apos;acheteur sera intégralement remboursé (prix,
                            frais de service et port), la part du vendeur
                            reprise ; la pièce ne sera pas remise en vente.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={busy === d.id}
                              onClick={() => void decideDispute(d, "lost")}
                            >
                              {busy === d.id
                                ? "En cours…"
                                : "Confirmer : colis perdu"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                swapThenFocus(
                                  () => setLostArmed(null),
                                  `${uid}-perdu-${d.id}`,
                                )
                              }
                            >
                              Ne pas trancher
                            </Button>
                          </div>
                        </div>
                      )}
                      {rowError?.id === d.id && (
                        <p
                          role="alert"
                          className="mt-2 text-[12.5px] leading-relaxed text-bone"
                        >
                          {rowError.message}
                        </p>
                      )}
                      <Link
                        href={`/commande/${d.id}`}
                        className="mt-2 inline-block text-[12px] text-ash underline-offset-4 hover:text-bone hover:underline"
                      >
                        Voir la commande →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---- versements à surveiller (D-037) ---- */}
          {state.payouts.length > 0 && (
            <section className="mt-8" aria-label="Versements à surveiller">
              <p className="etiquette mb-3 text-[11px] text-ash">
                Versements à surveiller · {state.payouts.length}
              </p>
              <div className="flex flex-col gap-2">
                {state.payouts.map((p) => {
                  const paid =
                    p.payout?.status === "envoye" ||
                    p.payout?.status === "simule";
                  return (
                    <div
                      key={p.id}
                      className="border border-bone/15 p-3.5 md:max-w-2xl"
                    >
                      <p className="font-display text-[14px] font-semibold text-bone">
                        {p.brand} — {p.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ash">
                        {p.id} · @{p.sellerHandle}
                        {p.netSellerEUR !== undefined
                          ? ` · part vendeur ${euro(p.netSellerEUR)}`
                          : ""}{" "}
                        · commande {STATUS_LABEL[p.status] ?? p.status}
                        {p.paidAt !== undefined
                          ? ` · J+${daysSince(state.now, p.paidAt)} depuis le paiement`
                          : ""}
                      </p>
                      {p.payout && (
                        <p className="mt-2 text-[13px] text-bone/85">
                          Versement {PAYOUT_LABEL[p.payout.status]} ·{" "}
                          {p.payout.attempts} tentative
                          {p.payout.attempts > 1 ? "s" : ""}
                          {p.payout.lastError && (
                            <span className="mt-1 block text-[12px] text-ash">
                              {p.payout.lastError}
                            </span>
                          )}
                        </p>
                      )}
                      {p.refundAfterPayout && (
                        <p className="mt-2 text-[12.5px] text-danger">
                          Remboursé après versement : solde vendeur négatif (
                          {when(p.refundAfterPayout.at)}).
                        </p>
                      )}
                      {p.bankDispute && (
                        <p className="mt-2 text-[12.5px] text-danger">
                          {p.bankDispute.closedAt !== undefined
                            ? `Contestation bancaire perdue le ${when(p.bankDispute.closedAt)} : virement suspendu, à décider.`
                            : `Contestation bancaire en cours depuis le ${when(p.bankDispute.at)} : virement suspendu.`}
                        </p>
                      )}
                      {!paid && p.retryable === false && (
                        <p className="mt-2 text-[12.5px] text-ash">
                          Pas de relance possible : le virement part à la
                          clôture de la commande, ou d&apos;office à J+80 une
                          fois la pièce expédiée.
                          {p.status === "litige"
                            ? " Tranche d'abord le litige."
                            : ""}
                        </p>
                      )}
                      {!paid && p.retryable !== false && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!p.bankDispute ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy === p.id}
                              onClick={() => void retryPayout(p, false)}
                            >
                              {busy === p.id
                                ? "En cours…"
                                : "Réessayer le versement"}
                            </Button>
                          ) : overrideArmed !== p.id ? (
                            <Button
                              id={`${uid}-forcer-${p.id}`}
                              variant="outline"
                              size="sm"
                              disabled={busy === p.id}
                              onClick={() =>
                                swapThenFocus(
                                  () => setOverrideArmed(p.id),
                                  `${uid}-forcer-aide-${p.id}`,
                                )
                              }
                            >
                              Verser malgré la contestation
                            </Button>
                          ) : (
                            <div className="w-full border border-danger/60 p-3.5">
                              <p
                                id={`${uid}-forcer-aide-${p.id}`}
                                tabIndex={-1}
                                className="text-[12.5px] leading-relaxed text-bone/85"
                              >
                                Si la banque donne raison à l&apos;acheteur, la
                                somme sera reprise sur un solde vendeur déjà
                                versé : il deviendra négatif, et SOLANGE en
                                répond. Verser quand même&nbsp;?
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={busy === p.id}
                                  onClick={() => void retryPayout(p, true)}
                                >
                                  {busy === p.id
                                    ? "En cours…"
                                    : "Confirmer le versement"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    swapThenFocus(
                                      () => setOverrideArmed(null),
                                      `${uid}-forcer-${p.id}`,
                                    )
                                  }
                                >
                                  Ne pas verser
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {rowError?.id === p.id && (
                        <p
                          role="alert"
                          className="mt-2 text-[12.5px] leading-relaxed text-bone"
                        >
                          {rowError.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---- signalements ---- */}
          <section className="mt-8" aria-label="Signalements">
            <p className="etiquette mb-3 text-[11px] text-ash">
              Signalements · {items.length}
            </p>

            {items.length === 0 ? (
              <p className="border border-bone/10 px-4 py-6 text-center text-[13px] text-ash">
                {queue === "open"
                  ? "Rien à traiter. La file est vide."
                  : "Aucun signalement dans cette vue."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <article
                    key={it.id}
                    className="border border-bone/12 p-3.5 md:max-w-2xl"
                  >
                    <div className="flex items-start gap-3">
                      {it.context?.image && (
                        <span className="size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-bone/10">
                          <Photo src={it.context.image} alt="" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="etiquette border border-bone/25 px-1.5 py-0.5 text-[10px] text-bone/70">
                            {TARGET_LABEL[it.targetType as ReportTargetType] ??
                              it.targetType}
                          </span>
                          <span className="font-display truncate text-[14px] font-semibold text-bone">
                            {it.context?.label ?? it.targetId}
                          </span>
                          {it.context?.hidden && (
                            <span className="etiquette text-[10px] text-danger">
                              masqué
                            </span>
                          )}
                        </p>
                        {it.context?.excerpt && (
                          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ash">
                            {it.context.excerpt}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11.5px] text-ash">
                          {it.context?.authorHandle
                            ? `@${it.context.authorHandle}`
                            : "auteur inconnu"}
                          {it.priorReports > 1 && (
                            <span className="text-danger">
                              {" "}
                              · {it.priorReports} signalements
                            </span>
                          )}
                          {" · signalé par @"}
                          {it.reporterHandle} {waiting(it.at)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2.5 border-l-2 border-bone/25 pl-3 text-[13px] leading-relaxed text-bone/85">
                      {it.reason}
                    </p>

                    {it.status === "done" ? (
                      <>
                        <p className="mt-3 text-[12px] text-ash">
                          {modActionLabel(it.targetType, it.action ?? "")} par @
                          {it.resolvedBy}
                          {it.resolvedAt ? ` · ${when(it.resolvedAt)}` : ""}
                        </p>
                        {/* rétablir la photo lève aussi le verrou qui
                            empêche le membre d'en publier une autre */}
                        {photoModAction(it) === "unhide" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === it.id}
                            onClick={() => void runAction(it, "unhide")}
                            className="mt-2"
                          >
                            Rétablir la photo
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === it.id}
                          onClick={() => void runAction(it, "dismiss")}
                        >
                          Classer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === it.id}
                          onClick={() => {
                            setActing({ item: it, action: "warn" });
                            setNote("");
                          }}
                        >
                          Avertir
                        </Button>
                        {/* membre signalé : seule sa photo se masque */}
                        {(photoModAction(it) === "hide" ||
                          (it.targetType !== "user" &&
                            it.targetType !== "message")) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === it.id}
                            onClick={() => void runAction(it, "hide")}
                          >
                            {modActionLabel(it.targetType, "hide")}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === it.id || !it.context?.authorId}
                          onClick={() => {
                            setActing({ item: it, action: "suspend" });
                            setDays(7);
                          }}
                        >
                          Suspendre
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busy === it.id || !it.context?.authorId}
                          onClick={() => setActing({ item: it, action: "ban" })}
                        >
                          Bannir
                        </Button>
                      </div>
                    )}

                    {it.context?.link && (
                      <Link
                        href={it.context.link}
                        className="mt-2 inline-block text-[12px] text-ash underline-offset-4 hover:text-bone hover:underline"
                      >
                        Voir en contexte →
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ---- journal d'audit ---- */}
          <section className="mt-10" aria-label="Journal d'audit">
            <div className="flex items-center justify-between">
              <p className="etiquette text-[11px] text-ash">Journal</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (audit) return setAudit(null);
                  const res = await api.modAudit();
                  if (res.ok) setAudit(res.data.audit);
                }}
              >
                {audit ? "Masquer" : "Afficher"}
              </Button>
            </div>
            {audit && (
              <ol className="mt-3 flex flex-col gap-2">
                {audit.length === 0 && (
                  <li className="text-[13px] text-ash">
                    Aucune action enregistrée.
                  </li>
                )}
                {audit.map((a) => (
                  <li key={a.id} className="flex gap-3 text-[12.5px]">
                    <span className="w-28 shrink-0 text-ash">{when(a.at)}</span>
                    <span className="min-w-0 text-bone/85">
                      @{a.adminHandle} ·{" "}
                      {modActionLabel(a.targetType, a.action)} · {a.targetType}{" "}
                      {a.targetId}
                      {a.note ? (
                        <span className="text-ash"> — {a.note}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {/* ---- sheet : avertir / suspendre / bannir ---- */}
      <Sheet
        open={acting !== null}
        onClose={() => setActing(null)}
        eyebrow="Modération"
        title={acting ? MOD_ACTION_LABEL[acting.action] : ""}
      >
        {acting && (
          <div className="flex flex-col gap-4 px-5 py-4 pb-8">
            <p className="text-[13px] text-ash">
              {acting.item.context?.authorHandle
                ? `@${acting.item.context.authorHandle}`
                : acting.item.targetId}{" "}
              — {acting.item.context?.label}
            </p>

            {acting.action === "suspend" && (
              <div>
                <FieldLabel>Durée</FieldLabel>
                <div className="flex gap-2">
                  {SUSPEND_DAYS.map((d) => (
                    <Chip
                      key={d}
                      active={days === d}
                      onClick={() => setDays(d)}
                    >
                      {d} jours
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {acting.action !== "ban" && (
              <div>
                <FieldLabel>
                  {acting.action === "warn"
                    ? "Message à la personne"
                    : "Note (interne)"}
                </FieldLabel>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder={
                    acting.action === "warn"
                      ? "Ce qui pose problème, et ce qu'on attend."
                      : "Pourquoi cette décision."
                  }
                  className="field w-full resize-none"
                />
              </div>
            )}

            {acting.action === "ban" && (
              <p className="border border-danger/50 p-3 text-[13px] leading-relaxed text-bone/85">
                Le compte ne pourra plus se connecter. Ses contenus restent en
                ligne — masque-les séparément si nécessaire.
              </p>
            )}

            <Button
              variant={acting.action === "ban" ? "danger" : "primary"}
              size="lg"
              disabled={busy !== null}
              onClick={() =>
                void runAction(acting.item, acting.action, {
                  note: note.trim() || undefined,
                  days: acting.action === "suspend" ? days : undefined,
                })
              }
            >
              {busy
                ? "En cours…"
                : `Confirmer — ${MOD_ACTION_LABEL[acting.action]}`}
            </Button>
          </div>
        )}
      </Sheet>
    </PageShell>
  );
}
