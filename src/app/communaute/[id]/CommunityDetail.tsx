"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type Community } from "@/lib/mock";
import { api, type ApiThread } from "@/lib/api";
import { useStore } from "@/lib/store";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { TogglePill } from "@/components/ui/TogglePill";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified, Users, Comment, Check } from "@/components/chrome/icons";
import { compact } from "@/lib/utils";
import { track } from "@/lib/track";

/**
 * Fiche d'un cercle (lot 2) — les fils sont RÉELS : publiés par les
 * membres, triés épinglés puis dernière activité, marqueur « nouveau »
 * depuis la dernière visite. Publier exige d'avoir rejoint (revalidé
 * serveur). Un cercle vide invite à ouvrir le premier fil.
 */
export function CommunityDetail({ community: c }: { community: Community }) {
  const { isJoined, toggleJoin, user, refreshCirclesUnread } = useStore();
  const joined = isJoined(c.id);

  type Load =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; threads: ApiThread[]; lastSeenAt: number };
  const [state, setState] = useState<Load>({ kind: "loading" });

  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const seenSent = useRef(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setState({ kind: "loading" });
      const res = await api.circleThreads(c.id);
      if (res.ok)
        setState({
          kind: "ready",
          threads: res.data.threads,
          lastSeenAt: res.data.lastSeenAt,
        });
      else if (!quiet) setState({ kind: "error", message: res.error });
    },
    [c.id],
  );

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  // marque la visite (badge non-lus) une fois la liste affichée
  useEffect(() => {
    if (state.kind === "ready" && user && !seenSent.current) {
      seenSent.current = true;
      void api.circleSeen(c.id).then(() => void refreshCirclesUnread());
    }
  }, [state.kind, user, c.id, refreshCirclesUnread]);

  // fraîcheur discrète : revalidation silencieuse toutes les 30 s
  useEffect(() => {
    const t = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const publish = async () => {
    const tt = title.trim();
    if (!tt || busy) return;
    setBusy(true);
    setComposeError(null);
    const res = await api.circleNewThread({
      circleId: c.id,
      title: tt,
      text: text.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      track("circle_thread", { circle: c.id });
      setComposeOpen(false);
      setTitle("");
      setText("");
      void load(true);
    } else {
      setComposeError(res.error);
    }
  };

  const threadCount = state.kind === "ready" ? state.threads.length : null;

  return (
    <PageShell marginWord={c.name}>
      <PageHeader back="/communaute" eyebrow="Cercle" title={c.name} />

      <div className="flex items-start gap-4">
        <Avatar name={c.name} seed={c.seed} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-bone/90">{c.tagline}</p>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-ash">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" /> {compact(c.members)} membres
            </span>
            {threadCount !== null && (
              <span className="flex items-center gap-1.5">
                <Comment className="size-3.5" /> {threadCount} fil
                {threadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <TogglePill
        on={joined}
        onToggle={() => toggleJoin(c.id)}
        labelOn="Rejoint"
        labelOff="Rejoindre le cercle"
        iconOn={<Check className="size-4" />}
        className="mt-5 w-full md:w-auto md:px-8"
      />

      <p className="mt-6 max-w-md text-[13.5px] leading-relaxed text-bone/80">
        {c.about}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.topics.map((t) => (
          <span
            key={t}
            className="border border-bone/20 px-2.5 py-1 text-[11px] font-medium text-bone/70"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2.5 border-t border-bone/10 pt-5">
        <Avatar name={c.host.name} seed={c.host.seed} className="size-9" />
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1 truncate text-[13px] font-semibold text-bone">
            {c.host.name}
            {c.host.verified && (
              <Verified className="size-3.5 shrink-0 text-bone" />
            )}
          </p>
          <p className="etiquette text-[10px] text-ash">Animé par</p>
        </div>
      </div>

      {/* ---- fils réels ---- */}
      <div className="mt-8 flex items-center justify-between">
        <p className="etiquette text-[11px] text-bone/50">Fils</p>
        {joined && state.kind === "ready" && state.threads.length > 0 && (
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            Ouvrir un fil
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {state.kind === "loading" && (
          <div aria-busy="true" className="flex flex-col gap-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-bone/15 px-3.5 py-3">
            <p className="text-[13px] text-ash">
              Les fils n&apos;ont pas chargé — {state.message}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              data-cursor="link"
              className="text-[13px] font-semibold text-bone underline-offset-4 hover:underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {state.kind === "ready" && state.threads.length === 0 && (
          <div className="flex flex-col items-start gap-3 border border-bone/10 px-4 py-6">
            <p className="text-[13.5px] leading-relaxed text-ash">
              Personne n&apos;a encore ouvert de fil ici.
              {joined
                ? " Lance la première discussion."
                : " Rejoins le cercle et lance la première discussion."}
            </p>
            {joined ? (
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                Ouvrir le premier fil
              </Button>
            ) : !user ? (
              <p className="text-[12px] text-ash">
                Connecte-toi depuis ton profil pour participer.
              </p>
            ) : null}
          </div>
        )}

        {state.kind === "ready" &&
          state.threads.map((t) => {
            const isNew =
              user !== null &&
              state.lastSeenAt > 0 &&
              t.lastActivityAt > state.lastSeenAt;
            return (
              <Link
                key={t.id}
                href={`/communaute/${c.id}/fil/${t.id}`}
                data-cursor="link"
                className="flex gap-3 border border-bone/10 p-3.5 transition-colors hover:border-bone/25 hover:bg-bone/[0.03]"
              >
                <Avatar
                  name={t.authorName}
                  seed={t.authorHandle}
                  className="size-9 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold text-bone">
                    <span className="truncate">{t.title}</span>
                    {t.pinned && (
                      <span className="etiquette shrink-0 border border-bone/25 px-1.5 py-0.5 text-[10px] text-bone/70">
                        Épinglé
                      </span>
                    )}
                    {isNew && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-bone"
                        aria-label="Nouveau depuis ta dernière visite"
                      />
                    )}
                  </p>
                  {t.text && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ash">
                      {t.text}
                    </p>
                  )}
                  <p className="mt-1.5 flex items-center gap-2 text-[11px] text-ash/80">
                    <span>@{t.authorHandle}</span>
                    <span className="size-0.5 rounded-full bg-ash" />
                    <span>
                      {t.replyCount} réponse{t.replyCount > 1 ? "s" : ""}
                    </span>
                    {t.likes > 0 && (
                      <>
                        <span className="size-0.5 rounded-full bg-ash" />
                        <span>
                          {t.likes} j&apos;aime{t.likes > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
      </div>

      <Link
        href="/communaute"
        className="mt-8 inline-block text-[12.5px] text-ash underline-offset-4 transition-colors hover:text-bone hover:underline"
      >
        ← Tous les cercles
      </Link>

      {/* composer — membre uniquement (le serveur revalide) */}
      <Sheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        eyebrow={c.name}
        title="Ouvrir un fil"
      >
        <div className="flex flex-col gap-4 px-5 py-4 pb-8">
          <div>
            <FieldLabel>Titre</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="De quoi tu veux parler ?"
              className="field w-full"
            />
          </div>
          <div>
            <FieldLabel>Texte (facultatif)</FieldLabel>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Développe, mentionne des @membres…"
              className="field w-full resize-none"
            />
          </div>
          {composeError && (
            <p role="alert" className="text-[13px] text-bone/85">
              {composeError}
            </p>
          )}
          <Button size="lg" disabled={busy || !title.trim()} onClick={publish}>
            {busy ? "Publication…" : "Publier le fil"}
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
