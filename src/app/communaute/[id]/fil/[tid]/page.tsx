"use client";

/* ============================================================
   SOLANGE — /communaute/[id]/fil/[tid] (lot 2)
   Un fil de Cercle : post complet, réponses, composer (membre),
   j'aime, suppression de SES messages, signalement. Client + un
   fetch + squelette (D-017 étendu : Blobs = functions).
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, type ApiCircleReply, type ApiThread } from "@/lib/api";
import { useStore } from "@/lib/store";
import { communityById } from "@/lib/mock";
import { track } from "@/lib/track";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ReportSheet } from "@/components/ui/ReportSheet";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/chrome/Avatar";
import { Photo } from "@/components/ui/Photo";
import { Heart } from "@/components/chrome/icons";

const when = (t: number) =>
  new Date(t).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** @handles cliquables vers les profils membres. */
function Mentions({ text }: { text: string }) {
  const parts = text.split(/(@[a-z0-9][a-z0-9._-]{1,30})/gi);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <Link
            key={i}
            href={`/membre/${encodeURIComponent(p.slice(1))}`}
            className="font-semibold text-bone underline-offset-4 hover:underline"
          >
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function FilPage() {
  const params = useParams<{ id: string; tid: string }>();
  const circleId = typeof params?.id === "string" ? params.id : "";
  const tid = typeof params?.tid === "string" ? params.tid : "";
  const circle = communityById(circleId);
  const { user, isJoined } = useStore();
  const joined = isJoined(circleId);

  type Load =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "notfound" }
    | { kind: "ready"; thread: ApiThread; replies: ApiCircleReply[] };
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await api.circleThread(tid);
    if (res.ok)
      setState({
        kind: "ready",
        thread: res.data.thread,
        replies: res.data.replies,
      });
    else if (res.status === 404) setState({ kind: "notfound" });
    else setState({ kind: "error", message: res.error });
  }, [tid]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!tid) setState({ kind: "notfound" });
      else void load();
    });
  }, [tid, load]);

  const reply = async () => {
    const text = draft.trim();
    if (!text || busy || state.kind !== "ready") return;
    setBusy(true);
    setActionError(null);
    const res = await api.circleReply(tid, text);
    setBusy(false);
    if (res.ok) {
      track("circle_reply", { circle: circleId });
      setDraft("");
      setState((s) =>
        s.kind === "ready"
          ? { ...s, replies: [...s.replies, res.data.reply] }
          : s,
      );
    } else {
      setActionError(res.error);
    }
  };

  const toggleLike = async () => {
    if (state.kind !== "ready" || !user) return;
    // optimiste + vérité serveur au retour
    setState((s) =>
      s.kind === "ready"
        ? {
            ...s,
            thread: {
              ...s.thread,
              liked: !s.thread.liked,
              likes: s.thread.likes + (s.thread.liked ? -1 : 1),
            },
          }
        : s,
    );
    const res = await api.circleLike(tid);
    if (res.ok)
      setState((s) =>
        s.kind === "ready"
          ? {
              ...s,
              thread: {
                ...s.thread,
                liked: res.data.liked,
                likes: res.data.likes,
              },
            }
          : s,
      );
  };

  const removeReply = async (replyId: string) => {
    const res = await api.circleDelete(tid, replyId);
    if (res.ok)
      setState((s) =>
        s.kind === "ready"
          ? { ...s, replies: s.replies.filter((r) => r.id !== replyId) }
          : s,
      );
    else setActionError(res.error);
  };

  const removeThread = async () => {
    const res = await api.circleDelete(tid);
    if (res.ok) location.assign(`/communaute/${circleId}`);
    else setActionError(res.error);
  };

  return (
    <PageShell marginWord={circle?.name ?? "Cercle"}>
      <PageHeader
        back={`/communaute/${circleId}`}
        eyebrow={circle?.name ?? "Cercle"}
        title="Fil"
      />

      {state.kind === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-3 md:max-w-md">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {state.kind === "notfound" && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <h2 className="font-editorial text-3xl font-semibold tracking-tight text-bone">
            Fil introuvable
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ash">
            Il a peut-être été supprimé par son auteur.
          </p>
          <Button href={`/communaute/${circleId}`} className="mt-8">
            Retour au cercle
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="max-w-sm text-[14px] leading-relaxed text-ash">
            {state.message}
          </p>
          <Button onClick={() => void load()} className="mt-8">
            Réessayer
          </Button>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="md:max-w-md">
          <ReportSheet
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            targetType="thread"
            targetId={state.thread.id}
            targetLabel={`« ${state.thread.title} »`}
          />

          {/* le fil */}
          <div className="flex items-start gap-3">
            <Avatar
              name={state.thread.authorName}
              seed={state.thread.authorHandle}
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-bold leading-snug tracking-tight text-bone">
                {state.thread.title}
                {state.thread.pinned && (
                  <span className="etiquette ml-2 border border-bone/25 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-bone/70">
                    Épinglé
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-ash">
                <Link
                  href={`/membre/${encodeURIComponent(state.thread.authorHandle)}`}
                  className="hover:underline"
                >
                  @{state.thread.authorHandle}
                </Link>{" "}
                · {when(state.thread.createdAt)}
              </p>
            </div>
          </div>

          {state.thread.text && (
            <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-bone/90">
              <Mentions text={state.thread.text} />
            </p>
          )}
          {state.thread.image && (
            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-bone/10">
              <Photo src={state.thread.image} alt="" />
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 border-b border-bone/10 pb-4">
            <button
              type="button"
              onClick={toggleLike}
              disabled={!user}
              aria-pressed={state.thread.liked}
              data-cursor="link"
              className="flex min-h-9 items-center gap-1.5 text-[12.5px] font-medium text-bone/80 transition-colors hover:text-bone disabled:opacity-40"
            >
              <Heart filled={state.thread.liked} className="size-4" />
              {state.thread.likes > 0 ? state.thread.likes : "J'aime"}
            </button>
            {user && user.id !== state.thread.authorId && (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                data-cursor="link"
                className="min-h-9 text-[12.5px] text-ash transition-colors hover:text-bone"
              >
                Signaler
              </button>
            )}
            {user && user.id === state.thread.authorId && (
              <button
                type="button"
                onClick={() => void removeThread()}
                data-cursor="link"
                className="min-h-9 text-[12.5px] text-ash transition-colors hover:text-bone"
              >
                Supprimer le fil
              </button>
            )}
          </div>

          {/* réponses */}
          <ol className="mt-4 flex flex-col gap-4">
            {state.replies.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <Avatar
                  name={r.authorHandle}
                  seed={r.authorHandle}
                  className="size-8 shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] text-ash">
                    <Link
                      href={`/membre/${encodeURIComponent(r.authorHandle)}`}
                      className="font-medium text-bone/80 hover:underline"
                    >
                      @{r.authorHandle}
                    </Link>{" "}
                    · {when(r.at)}
                    {user && user.id === r.authorId && (
                      <button
                        type="button"
                        onClick={() => void removeReply(r.id)}
                        data-cursor="link"
                        className="ml-2 text-ash underline-offset-4 hover:text-bone hover:underline"
                      >
                        supprimer
                      </button>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-bone/90">
                    <Mentions text={r.text} />
                  </p>
                </div>
              </li>
            ))}
            {state.replies.length === 0 && (
              <li className="text-[13px] text-ash">
                Pas encore de réponse — lance la discussion.
              </li>
            )}
          </ol>

          {actionError && (
            <p role="alert" className="mt-4 text-[13px] text-bone/85">
              {actionError}
            </p>
          )}

          {/* composer */}
          {joined && user ? (
            <div className="mt-6 flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Réponds, mentionne des @membres…"
                aria-label="Ta réponse"
                className="field w-full flex-1 resize-none"
              />
              <Button
                size="md"
                disabled={busy || !draft.trim()}
                onClick={() => void reply()}
              >
                {busy ? "Envoi…" : "Répondre"}
              </Button>
            </div>
          ) : (
            <p className="mt-6 text-[13px] text-ash">
              {user
                ? "Rejoins le cercle pour répondre."
                : "Connecte-toi et rejoins le cercle pour répondre."}
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
