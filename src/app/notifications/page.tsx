"use client";

import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/chrome/Avatar";
import { Bell } from "@/components/chrome/icons";
import { notifications } from "@/lib/mock";

export default function NotificationsPage() {
  const unread = notifications.filter((n) => n.unread).length;

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

      {notifications.length > 0 ? (
        <ul className="space-y-2.5">
          {notifications.map((n) => (
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
    </PageShell>
  );
}
