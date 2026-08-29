/* /api/notifications — cloche réelle.
   GET → mes notifications (50 max, récentes d'abord) + compteur non-lues.
   POST → tout marquer lu. */
import type { Config } from "@netlify/functions";
import { store, json, bad, currentUser, sameOrigin } from "./_shared/core.mts";

type Notif = {
  id: string;
  type: string;
  text: string;
  link: string;
  at: number;
  read: boolean;
};

export default async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return json({ notifications: [], unread: 0 });
  const notifs = store("notifs");
  const list =
    ((await notifs.get(`n:${user.id}`, { type: "json" })) as Notif[]) ?? [];

  if (req.method === "POST") {
    if (!sameOrigin(req)) return bad("Origine refusée", 403);
    await notifs.setJSON(
      `n:${user.id}`,
      list.map((n) => ({ ...n, read: true })),
    );
    return json({ ok: true });
  }

  const sorted = [...list].reverse();
  return json({
    notifications: sorted,
    unread: list.filter((n) => !n.read).length,
  });
};

export const config: Config = { path: "/api/notifications" };
