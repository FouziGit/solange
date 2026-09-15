/* POST /api/auth/send-code — génère un OTP 6 chiffres (crypto), le hache,
   l'envoie par email via Resend. Cooldown 60 s, expiration 10 min.

   TROIS FREINS, ET ILS NE PROTÈGENT PAS LA MÊME CHOSE.

   Le cooldown de 60 s est posé sous la clé de la VICTIME : il empêche de
   harceler une adresse donnée, mais il n'oppose rien à quelqu'un qui boucle
   sur une liste d'adresses. Cet endpoint n'est pas authentifié et chaque
   appel envoie un email : sans plafond par appelant, on épuise le quota
   Resend, et le jour où il est épuisé PLUS PERSONNE ne peut se connecter —
   l'OTP est l'unique moyen d'authentification. S'y ajoute la réputation du
   domaine, qui sert aussi ailleurs.

   D'où deux plafonds supplémentaires, posés AVANT l'envoi :
   - par appelant (IP), qui arrête l'abus ordinaire ;
   - global, qui borne la facture même en attaque distribuée, au prix
     d'un déni de service partiel assumé — mieux vaut une heure sans
     inscription qu'un quota mort et un domaine brûlé. */
import type { Config } from "@netlify/functions";
import {
  store,
  json,
  bad,
  sha256,
  otpCode,
  sameOrigin,
  readJson,
  rateLimit,
} from "./_shared/core.mts";

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async (req: Request) => {
  if (req.method !== "POST") return bad("Méthode non autorisée", 405);
  if (!sameOrigin(req)) return bad("Origine refusée", 403);

  const body = await readJson<{ email?: string }>(req);
  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!emailRe.test(email) || email.length > 254) return bad("Email invalide");

  /* Plafonds AVANT l'envoi. L'IP vient de l'en-tête posé par le edge
     Netlify ; absente, on retombe sur un seau commun plutôt que d'ouvrir
     une voie de contournement à qui saurait la supprimer. */
  const ip =
    req.headers.get("x-nf-client-connection-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "inconnue";
  if (!(await rateLimit(`otp-ip:${ip}`, 5, 3_600_000)))
    return bad("Trop de demandes de code — réessaie dans une heure", 429);
  if (!(await rateLimit("otp-global", 200, 3_600_000)))
    return bad(
      "Trop de demandes en cours sur le service — réessaie dans un moment",
      429,
    );

  const otps = store("otps");
  const key = sha256(email);
  const now = Date.now();

  const prev = (await otps.get(key, { type: "json" })) as {
    sentAt: number;
  } | null;
  if (prev && now - prev.sentAt < 60_000) {
    return bad("Attends une minute avant de redemander un code", 429);
  }

  const code = otpCode();
  await otps.setJSON(key, {
    h: sha256(code + key),
    exp: now + 10 * 60_000,
    tries: 0,
    sentAt: now,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "SOLANGE <solange@nouhbenzidane.fr>",
      to: [email],
      subject: `${code} — ton code SOLANGE`,
      html: `<div style="background:#0d0d0e;color:#f4f1ea;font-family:Helvetica,Arial,sans-serif;padding:48px 24px;text-align:center">
        <p style="letter-spacing:.35em;font-size:12px;margin:0 0 32px">S O L A N G E</p>
        <p style="font-size:13px;color:#b8b3a8;margin:0 0 12px">Ton code de connexion</p>
        <p style="font-size:40px;letter-spacing:.3em;font-weight:600;margin:0 0 32px">${code}</p>
        <p style="font-size:12px;color:#8a857b;margin:0">Valable 10 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      </div>`,
    }),
  });

  if (!res.ok) {
    // Ne jamais révéler le code ni l'erreur détaillée au client.
    console.error("resend_error", res.status);
    return bad("Envoi de l'email impossible pour le moment", 502);
  }
  return json({ ok: true });
};

export const config: Config = { path: "/api/auth/send-code" };
