"use client";

import { useEffect, useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TogglePill } from "@/components/ui/TogglePill";
import { LuxeMedia } from "@/components/ui/LuxeMedia";
import { Avatar } from "@/components/chrome/Avatar";
import { Verified, ArrowLeft, Send, Bell } from "@/components/chrome/icons";
import { catalogItem, type Stream, type ChatLine } from "@/lib/mock";
import { imgItem } from "@/lib/img";
import { cn, compact, euro, EASE } from "@/lib/utils";

/* ============================================================
   Live shopping — the social-commerce moment.
   Grid of live streams (looping muted previews) + upcoming
   rows, opening into a full-screen viewer with live chat and
   a shoppable product rail. Mock data only, strict noir & blanc.
   ============================================================ */

/** Looping muted preview that fails open to the LuxeMedia still. */
function StreamVideo({
  src,
  poster,
  seed,
  muted = true,
  eager,
  className,
}: {
  src: string;
  poster: string;
  seed: string;
  muted?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  // Keep autoplay working (muted at mount) while letting the viewer un-mute.
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  // Ne joue que visible : trois autoplay simultanés hors écran = batterie et
  // décodeur gaspillés. ≥50 % visible → play, sinon pause (perf, DA §7).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (failed) return <LuxeMedia seed={seed} watermark className={className} />;

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={eager ? "metadata" : "none"}
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", className)}
    />
  );
}

/** Small filled-eye glyph for the viewer-count pill. */
function Eye({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function SoundIcon({
  muted,
  className,
}: {
  muted: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 9v6h3.5L13 20V4L7.5 9H4Z" />
      {muted ? (
        <path d="m17 9 4 6M21 9l-4 6" />
      ) : (
        <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
      )}
    </svg>
  );
}

/** Pulsing EN DIRECT badge (bone dot + ping). */
function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 backdrop-blur-md",
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-bone" />
      </span>
      <span className="etiquette text-[11px] text-bone">En direct</span>
    </span>
  );
}

/** A single live stream tile in the EN DIRECT grid. */
function LiveTile({
  stream,
  index,
  onOpen,
}: {
  stream: Stream;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      data-cursor="link"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE.luxe, delay: index * 0.05 }}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-bone/10 text-left"
    >
      <StreamVideo
        src={stream.video}
        poster={stream.poster}
        seed={stream.seed}
      />

      {/* top overlays */}
      <LiveBadge className="absolute left-3 top-3" />
      <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 backdrop-blur-md">
        <Eye className="size-3.5 text-bone" />
        <span className="text-[11px] font-medium text-bone">
          {compact(stream.viewers)}
        </span>
      </span>

      {/* bottom gradient + creator */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/45 to-transparent p-4 pt-12">
        <div className="flex items-center gap-2.5">
          <Avatar
            name={stream.creator.name}
            seed={stream.creator.seed}
            className="size-9 shrink-0"
          />
          <div className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate text-[13px] font-semibold text-bone">
                @{stream.creator.handle}
              </span>
              {stream.creator.verified && (
                <Verified className="size-3.5 shrink-0 text-bone" />
              )}
            </span>
            <p className="truncate text-[12px] text-ash">{stream.title}</p>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/** "Me prévenir" reminder switch on an upcoming stream. */
function RemindToggle() {
  const [on, setOn] = useState(false);
  return (
    <TogglePill
      on={on}
      onToggle={() => setOn((v) => !v)}
      labelOn="Prévu"
      labelOff="Me prévenir"
      iconOn={<Bell className="size-3.5" />}
      iconOff={<Bell className="size-3.5" />}
      size="sm"
      switchRole
      aria-label="Me prévenir au début du live"
    />
  );
}

/** Upcoming stream row. */
function UpcomingRow({ stream, index }: { stream: Stream; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE.luxe, delay: index * 0.05 }}
      className="glass flex items-center gap-3 rounded-2xl px-3.5 py-3"
    >
      <Avatar
        name={stream.creator.name}
        seed={stream.creator.seed}
        className="size-12 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold text-bone">
            {stream.title}
          </span>
          {stream.creator.verified && (
            <Verified className="size-3.5 shrink-0 text-bone" />
          )}
        </span>
        <span className="block truncate text-[12px] text-ash">
          @{stream.creator.handle}
          {stream.startsIn ? ` · ${stream.startsIn}` : ""}
        </span>
      </div>
      <RemindToggle />
    </motion.div>
  );
}

/** One chat line (avatar + handle + text). */
function ChatRow({ line }: { line: ChatLine }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar
        name={line.handle}
        seed={line.seed}
        className="mt-0.5 size-6 shrink-0 text-[11px]"
      />
      <p className="min-w-0 text-[13px] leading-snug text-bone/90">
        <span className="mr-1.5 font-semibold text-bone/60">
          @{line.handle}
        </span>
        {line.text}
      </p>
    </div>
  );
}

/** Horizontal strip of the stream's shoppable pieces. */
function ShoppableRail({ productIds }: { productIds: string[] }) {
  const items = productIds
    .map((id) => catalogItem(id))
    .filter((it): it is NonNullable<typeof it> => it !== undefined);
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2.5 overflow-x-auto px-4 py-3">
      {items.map((it) => (
        <div
          key={it.id}
          className="glass flex w-[248px] shrink-0 items-center gap-2.5 rounded-2xl p-2"
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
            <LuxeMedia
              seed={it.seed}
              image={imgItem(it.id)}
              small
              watermark={false}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-ash">{it.brand}</p>
            <p className="truncate text-[12.5px] leading-tight text-bone">
              {it.name}
            </p>
            <p className="font-display text-[13px] font-bold text-bone">
              {euro(it.priceEUR)}
            </p>
          </div>
          <Button href={`/article/${it.id}`} size="sm">
            Acheter
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Composer input shared by the mobile overlay and desktop chat panel. */
function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
  };
  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Commente le live…"
        aria-label="Écrire dans le chat"
        className="glass h-11 flex-1 rounded-full px-4 text-base text-bone outline-none placeholder:text-ash md:text-[13.5px]"
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Envoyer le message"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-ink transition-transform active:scale-90"
      >
        <Send className="size-5" />
      </button>
    </div>
  );
}

/** Full-screen live viewer: player + chat + shoppable rail. */
function Viewer({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const [muted, setMuted] = useState(true);
  const [mine, setMine] = useState<ChatLine[]>([]);
  const chat = [...stream.chat, ...mine];

  const send = (text: string) =>
    setMine((m) => [...m, { handle: "toi", seed: "solange-me-01", text }]);

  // Escape closes the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const header = (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar
        name={stream.creator.name}
        seed={stream.creator.seed}
        className="size-10 shrink-0"
      />
      <div className="min-w-0">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold text-bone">
            @{stream.creator.handle}
          </span>
          {stream.creator.verified && (
            <Verified className="size-3.5 shrink-0 text-bone" />
          )}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-ash">
          <span className="flex items-center gap-1">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-bone opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-bone" />
            </span>
            En direct
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            {compact(stream.viewers)}
          </span>
        </span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE.luxe }}
      className="fixed inset-0 z-[70] flex flex-col bg-coal md:flex-row"
      role="dialog"
      aria-label={`Live · ${stream.title}`}
    >
      {/* STAGE */}
      <div className="relative min-h-0 flex-1">
        <StreamVideo
          src={stream.video}
          poster={stream.poster}
          seed={stream.seed}
          muted={muted}
          eager
          className="absolute inset-0"
        />

        {/* top scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/85 to-transparent" />

        {/* top bar: close + creator */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le live"
            data-cursor="link"
            className="glass grid size-11 shrink-0 place-items-center rounded-full text-bone transition-transform active:scale-90"
          >
            <ArrowLeft className="size-5" />
          </button>
          {header}
        </div>

        {/* mute toggle */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          aria-pressed={!muted}
          data-cursor="link"
          className="glass absolute right-4 top-[calc(5.5rem+env(safe-area-inset-top))] z-10 grid size-11 place-items-center rounded-full text-bone transition-transform active:scale-90 md:bottom-4 md:top-auto"
        >
          <SoundIcon muted={muted} className="size-5" />
        </button>

        {/* desktop: shoppable rail pinned to the bottom of the stage */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-ink to-transparent pt-16 md:block">
          <div className="pointer-events-auto">
            <ShoppableRail productIds={stream.productIds} />
          </div>
        </div>

        {/* mobile: chat + rail + composer overlay */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col md:hidden">
          <div className="pointer-events-none h-24 bg-gradient-to-t from-coal to-transparent" />
          <div className="bg-coal">
            <ShoppableRail productIds={stream.productIds} />
            <div className="flex max-h-40 flex-col justify-end gap-2 overflow-y-auto px-4">
              {chat.slice(-6).map((line, i) => (
                <ChatRow key={i} line={line} />
              ))}
            </div>
            <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <Composer onSend={send} />
            </div>
          </div>
        </div>
      </div>

      {/* desktop: live chat panel */}
      <aside className="hidden w-[380px] shrink-0 flex-col border-l border-bone/10 bg-ink/40 md:flex">
        <header className="flex items-center gap-2 border-b border-bone/10 px-4 py-4">
          <p className="eyebrow text-sm text-bone/55">Chat en direct</p>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ash">
            <Eye className="size-3.5" />
            {compact(stream.viewers)}
          </span>
        </header>
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
          {chat.map((line, i) => (
            <ChatRow key={i} line={line} />
          ))}
        </div>
        <div className="border-t border-bone/10 px-4 py-3">
          <Composer onSend={send} />
        </div>
      </aside>
    </motion.div>
  );
}

export function StreamsView({ streams }: { streams: Stream[] }) {
  const [selId, setSelId] = useState<string | null>(null);
  const live = streams.filter((s) => s.live);
  const upcoming = streams.filter((s) => !s.live);
  const selected = streams.find((s) => s.id === selId) ?? null;

  return (
    <PageShell marginWord="Live">
      <PageHeader
        eyebrow="Live shopping"
        title="En direct"
        subtitle="Les vendeurs présentent leurs pièces en live. Commente, pose tes questions, achète avant que ça parte."
      />

      {/* EN DIRECT grid */}
      {live.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {live.map((s, i) => (
            <LiveTile
              key={s.id}
              stream={s}
              index={i}
              onOpen={() => setSelId(s.id)}
            />
          ))}
        </div>
      )}

      {/* À venir */}
      {upcoming.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-editorial text-2xl font-semibold tracking-tight text-bone">
              À venir
            </h2>
            <span className="etiquette text-[11px] text-bone/35">
              Nº {String(upcoming.length).padStart(2, "0")}
            </span>
          </div>
          <div className="space-y-2.5">
            {upcoming.map((s, i) => (
              <UpcomingRow key={s.id} stream={s} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Full-screen viewer */}
      <AnimatePresence>
        {selected && (
          <Viewer stream={selected} onClose={() => setSelId(null)} />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
