/* Alerte des administrateurs (D-037) : cloche (+ push web) pour chaque
   adresse de ADMIN_EMAILS qui a un compte, et e-mail si un objet est
   fourni. Utilisée par les versements vendeur, le cron des litiges et les
   conflits de commande.

   Les liens pointent vers /admin : GET /api/orders?id= renvoie 404 aux
   administrateurs (ils ne sont ni acheteur ni vendeur), un lien
   /commande/<id> ne leur ouvrirait rien.

   Jamais d'exception : une alerte ratée est journalisée, elle ne fait
   échouer ni la transition, ni le versement, ni le cron qui l'a émise. */
import { APP_URL, pushNotif, sendEmail, sha256, store } from "./core.mts";
import { escapeHtml } from "../../../src/lib/guards.ts";

export type AlerteAdmin = {
  text: string;
  link: string;
  /** Présent : l'alerte part aussi par e-mail. */
  subject?: string;
  /** Corps de l'e-mail ; par défaut, le texte échappé et un lien. */
  html?: string;
};

export async function alerterAdmins(a: AlerteAdmin): Promise<void> {
  const mails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((raw) => raw.trim().toLowerCase())
    .filter(Boolean);
  if (!mails.length) {
    console.error("admin_alert_error", "ADMIN_EMAILS vide", a.text);
    return;
  }
  const users = store("users");
  for (const mail of mails) {
    try {
      const uid = await users.get(`email:${sha256(mail)}`, { type: "text" });
      if (uid)
        await pushNotif(uid, { type: "report", text: a.text, link: a.link });
      if (a.subject)
        await sendEmail(
          mail,
          a.subject,
          a.html ??
            `<p style="font-size:15px;margin:0 0 16px">${escapeHtml(a.text)}</p>
             <p style="margin:0"><a href="${APP_URL}${a.link}" style="color:#f4f1ea">Ouvrir →</a></p>`,
        );
    } catch (e) {
      console.error("admin_alert_error", (e as Error).message);
    }
  }
}
