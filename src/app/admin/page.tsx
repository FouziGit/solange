"use client";

/* ============================================================
   SOLANGE — /admin (lot 4) : la file de modération.
   Route absente de toute navigation ; le serveur renvoie 404 à
   quiconque n'est pas admin (on ne confirme pas son existence).
   Pensée pour le pouce : on traite un signalement d'une main,
   dans le métro, sans quitter la file.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  type ModAuditEntry,
  type ModDispute,
  type ModReportItem,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  MOD_ACTION_LABEL,
  SUSPEND_DAYS,
  TARGET_LABEL,
  type ModAction,
  type ReportTargetType,
} from "@/lib/moderation";
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

type Queue = "open" | "done" | "all";
type Load =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: ModReportItem[]; disputes: ModDispute[] };

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

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.modQueue(queue);
    if (res.ok)
      setState({
        kind: "ready",
        items: res.data.items,
        disputes: res.data.disputes,
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

  const decideDispute = async (
    d: ModDispute,
    decision: "cancel" | "close" | "return",
  ) => {
    setBusy(d.id);
    const res = await api.modDispute(d.id, decision);
    setBusy(null);
    if (res.ok) void load();
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

  return (
    <PageShell marginWord="Modération">
      <PageHeader
        eyebrow="Réservé"
        title="Modération"
        subtitle="Signalements et litiges. Chaque action laisse une trace."
      />

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
                {state.disputes.map((d) => (
                  <div
                    key={d.id}
                    className="border border-danger/50 p-3.5 md:max-w-2xl"
                  >
                    <p className="font-display text-[14px] font-semibold text-bone">
                      {d.brand} — {d.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ash">
                      @{d.buyerHandle} conteste · vendu par @{d.sellerHandle} ·{" "}
                      {euro(d.totalEUR)} ·{" "}
                      {waiting(d.dispute?.at ?? d.createdAt)}
                    </p>
                    <p className="mt-2 text-[13px] text-bone/85">
                      {d.dispute?.reason === "non_conforme"
                        ? "Pièce non conforme"
                        : "Pièce non reçue"}
                      {d.dispute?.note ? ` — ${d.dispute.note}` : ""}
                    </p>
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
                    </div>
                    <Link
                      href={`/commande/${d.id}`}
                      className="mt-2 inline-block text-[12px] text-ash underline-offset-4 hover:text-bone hover:underline"
                    >
                      Voir la commande →
                    </Link>
                  </div>
                ))}
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
                      <p className="mt-3 text-[12px] text-ash">
                        {MOD_ACTION_LABEL[it.action as ModAction] ?? it.action}{" "}
                        par @{it.resolvedBy}
                        {it.resolvedAt ? ` · ${when(it.resolvedAt)}` : ""}
                      </p>
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
                        {it.targetType !== "user" &&
                          it.targetType !== "message" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy === it.id}
                              onClick={() => void runAction(it, "hide")}
                            >
                              Masquer
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
                      {MOD_ACTION_LABEL[a.action as ModAction] ?? a.action} ·{" "}
                      {a.targetType} {a.targetId}
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
