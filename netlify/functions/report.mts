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
  pushNotif,
  sha256,
  sendEmail,
  APP_URL,
} from "./_shared/core.mts";
import { resolveHandle } from "./_shared/users.mts";
import { escapeHtml } from "../../src/lib/guards.ts";
import { normalizeHandle } from "../../src/lib/handle.ts";

const TYPES = new Set(["product", "post", "user", "message", "thread"]);

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

  /* Un membre (ou l'auteur d'un message) est désigné par son handle, qui
     peut changer. On note aussi son id, résolu maintenant, alias compris :
     la modération et la récidive le suivront sous son prochain handle.
     null : personne derrière ce handle (vendeur de démo, compte supprimé). */
  const targetUserId =
    targetType === "user" || targetType === "message"
      ? await resolveHandle(normalizeHandle(targetId))
      : undefined;

  const reports = store("reports");
  const id = newId("r");
  await reports.setJSON(`r:${id}`, {
    id,
    targetType,
    targetId,
    targetUserId,
    reason,
    reporterId: user.id,
    reporterHandle: user.handle,
    status: "open",
    at: Date.now(),
  });
  // Lot 4 : index — sans lui les signalements étaient écrits sans que
  // personne ne puisse jamais les relire.
  const idx = ((await reports.get("idx", { type: "json" })) as string[]) ?? [];
  idx.push(id);
  await reports.setJSON("idx", idx);

  // Lot 4 : les admins reçoivent aussi cloche + push (le mail seul se perd).
  const users = store("users");
  for (const raw of (process.env.ADMIN_EMAILS ?? "").split(",")) {
    const mail = raw.trim().toLowerCase();
    if (!mail) continue;
    const uid = (await users.get(`email:${sha256(mail)}`, {
      type: "text",
    })) as string | null;
    if (uid && uid !== user.id)
      await pushNotif(uid, {
        type: "report",
        text: `Signalement à traiter — ${targetType}`,
        link: "/admin",
      });
  }

  /* Destinataire en variable d'environnement. Sans elle, l'envoi n'a pas
     lieu : mieux vaut un signalement non routé et visible dans les logs
     qu'un signalement parti vers une adresse personnelle en dur qu'aucun
     document ne mentionne. */
  const to = process.env.REPORT_EMAIL?.trim();
  if (to) {
    await sendEmail(
      to,
      `⚠️ Signalement — ${targetType} ${targetId}`.slice(0, 180),
      `<p style="font-size:15px;margin:0 0 14px">@${escapeHtml(user.handle)} signale <strong>${escapeHtml(targetType)} ${escapeHtml(targetId)}</strong></p>
     <p style="font-size:14px;color:#b8b3a8;border-left:2px solid #3a3a3c;padding-left:12px;margin:0 0 20px">${escapeHtml(reason)}</p>
     <p style="margin:0;font-size:12px;color:#8a857b">Réf ${escapeHtml(id)} · ${APP_URL}</p>`,
    );
  } else {
    console.warn(
      "[report] REPORT_EMAIL absente — signalement",
      id,
      "non routé",
    );
  }

  return json({ ok: true });
};

export const config: Config = { path: "/api/report" };
