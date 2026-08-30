"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/chrome/Avatar";
import { Bell, Bag, Chat, Plus } from "@/components/chrome/icons";
import { notifications as mockNotifications } from "@/lib/mock";
import { api, type ApiNotif } from "@/lib/api";
import { useStore } from "@/lib/store";
import { SkeletonRow } from "@/components/ui/Skeleton";

/** Horodatage relatif fr : « il y a 2 h », « il y a 12 min », « hier »… */
function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(at).toLocaleDateString("fr-FR");
}

/** Icône par type de notification serveur. */
function NotifIcon({ type }: { type: ApiNotif["type"] }) {
  const Icon =
    type === "sale"
      ? Bag
      : type === "message"
        ? Chat
        : type === "follow"
          ? Plus
          : Bell;
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bone/10 text-bone/85">
      <Icon className="size-5" />
    </span>
  );
}

type Status = "loading" | "done" | "error";

export default function NotificationsPage() {
  const { user, authReady } = useStore();
  const [notifs, setNotifs] = useState<ApiNotif[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    queueMicrotask(() => setStatus("loading"));
    void api.notifications().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        // Les flags `read` d'origine restent en état local : les pastilles
        // non-lu demeurent visibles pour cette session.
        setNotifs(res.data.notifications);
        setStatus("done");
        // Marquage lu APRÈS affichage — fire-and-forget, sans refetch.
        if (res.data.unread > 0) void api.markNotifsRead();
      } else {
        setStatus("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, user, tick]);

  const mockUnread = mockNotifications.filter((n) => n.unread).length;
  const realUnread = notifs.filter((n) => !n.read).length;
  const unread = user ? realUnread : mockUnread;

  return (
    <PageShell marginWord="Activité">
      <PageHeader
        eyebrow="Notifications"
        title="Activité"
        right={
          <span className="inline-flex items-center gap-2 text-sm text-ash">
            <Bell className="size-4" />
            {unread > 0
              ? `${unread} non lue${unread > 1 ? "s" : ""}`
              : "À jour"}
          </span>
        }
      />

      {!authReady ? (
        /* — session en cours de résolution — */
        <p className="mt-20 text-center text-sm text-ash">Chargement…</p>
      ) : user ? (
        /* ————— membre connecté : notifications réelles ————— */
        status === "loading" ? (
          <div
            className="mt-8"
            aria-busy="true"
            aria-label="Chargement des notifications"
          >
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : status === "error" ? (
          <div className="mt-20 flex flex-col items-center gap-4">
            <p className="text-center text-sm text-ash">
              Impossible de charger tes notifications.
            </p>
            <button
              onClick={() => setTick((t) => t + 1)}
              className="glass min-h-11 rounded-full px-5 text-sm font-semibold text-bone transition-opacity hover:opacity-80"
            >
              Réessayer
            </button>
          </div>
        ) : notifs.length === 0 ? (
          <div className="mt-24 flex flex-col items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-bone/10 text-bone/70">
              <Bell className="size-6" />
            </span>
            <p className="text-sm font-semibold text-bone">
              Rien pour l&apos;instant
            </p>
            <p className="max-w-60 text-[13px] leading-snug text-ash">
              Tes ventes, messages et nouveaux abonnés apparaîtront ici.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {notifs.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link}
                  className="glass flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-opacity hover:opacity-90"
                >
                  <NotifIcon type={n.type} />
                  <p
                    className={`min-w-0 flex-1 text-[13px] leading-snug ${
                      n.read ? "text-ash" : "text-bone"
                    }`}
                  >
                    {n.text}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-ash">
                      {timeAgo(n.at)}
                    </span>
                    {!n.read && (
                      <span
                        className="size-2 rounded-full bg-bone"
                        aria-label="Non lue"
                      />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        /* ————— invité : liste mock + bandeau démo ————— */
        <>
          <div className="glass mb-4 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2">
            <p className="text-[13px] leading-snug text-ash">
              <span className="font-semibold text-bone">Démo</span> —
              connecte-toi pour tes vraies notifications.
            </p>
            <Link
              href="/profil"
              className="inline-flex min-h-11 shrink-0 items-center text-[13px] font-semibold text-bone underline underline-offset-4"
            >
              Se connecter
            </Link>
          </div>

          {mockNotifications.length > 0 ? (
            <ul className="space-y-2.5">
              {mockNotifications.map((n) => (
                <li
                  key={n.id}
                  className="glass flex items-center gap-3 rounded-2xl px-3.5 py-3"
                >
                  <Avatar
                    name={n.actorName}
                    seed={n.actorSeed}
                    className="size-11 shrink-0"
                  />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-ash">
                    <span className="font-semibold text-bone">
                      @{n.actorHandle}
                    </span>{" "}
                    {n.text}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] text-ash">{n.time}</span>
                    {n.unread && (
                      <span
                        className="size-2 rounded-full bg-bone"
                        aria-label="Non lue"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-20 text-center text-sm text-ash">
              Aucune activité pour l&apos;instant.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
