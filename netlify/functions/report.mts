/* POST /api/report — signalement (DSA) : annonce, post, membre ou message.
   Persisté + alerte email aux fondateurs. Plafond 10/jour/membre. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  newId,
  currentUser,
  sameOrigin,
  readJson,
  rateLimit,
  sendEmail,
  APP_URL,
} from "./_shared/core.mts";

const TYPES = new Set(["product", "post", "user", "message"]);

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const user = await currentUser(req);
  if (!user) return bad("Connecte-toi pour signaler", 401);

  const b = await readJson<{
    targetType?: string;
    targetId?: string;
    reason?: string;
  }>(req);
  const targetType = b?.targetType ?? "";
  const targetId = (b?.targetId ?? "").slice(0, 80);
  const reason = (b?.reason ?? "").trim().slice(0, 500);
  if (!TYPES.has(targetType) || !targetId || !reason)
    return bad("Signalement incomplet");

  if (!(await rateLimit(`report:${user.id}`, 10, 24 * 3_600_000)))
    return bad("Limite de signalements atteinte pour aujourd'hui", 429);

  const reports = store("reports");
  const id = newId("r");
  await reports.setJSON(`r:${id}`, {
    id,
    targetType,
    targetId,
    reason,
    reporterId: user.id,
    reporterHandle: user.handle,
    status: "open",
    at: Date.now(),
  });

  await sendEmail(
    process.env.REPORT_EMAIL ?? "fouzi.benzidane@gmail.com",
    `⚠️ Signalement — ${targetType} ${targetId}`,
    `<p style="font-size:15px;margin:0 0 14px">@${user.handle} signale <strong>${targetType} ${targetId}</strong></p>
     <p style="font-size:14px;color:#b8b3a8;border-left:2px solid #3a3a3c;padding-left:12px;margin:0 0 20px">${reason
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")}</p>
     <p style="margin:0;font-size:12px;color:#8a857b">Réf ${id} · ${APP_URL}</p>`,
  );

  return json({ ok: true });
};

export const config: Config = { path: "/api/report" };
