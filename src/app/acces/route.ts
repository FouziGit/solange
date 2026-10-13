import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessCode,
  accessToken,
  relativeRedirect,
  sameCode,
} from "@/lib/demo-access";

/* Écran de code d'accès du site de démonstration. Page HTML autonome
   (hors layout : pas d'AuthGate, pas de JavaScript), servie et vérifiée
   par le serveur. Sans DEMO_ACCESS_CODE, elle renvoie à l'accueil. */

export const dynamic = "force-dynamic";

/** Ne renvoie que vers une page du site, jamais vers un autre domaine. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function page(next: string, error: boolean) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0d0d0e">
<title>SOLANGE · Accès privé</title>
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{background:#0d0d0e;color:#f4f1eb;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
    display:flex;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased;
    background-image:radial-gradient(120% 80% at 50% 30%,rgba(244,241,235,.06),transparent 60%)}
  main{width:100%;max-width:340px;text-align:center}
  img{width:96px;height:96px;object-fit:contain}
  h1{margin:26px 0 0;padding-left:.42em;font-weight:300;font-size:1.5rem;letter-spacing:.42em}
  p{margin:14px 0 0;font-size:14px;line-height:1.55;color:rgba(244,241,235,.62)}
  form{margin-top:30px;display:flex;flex-direction:column;gap:12px}
  input{width:100%;min-height:52px;border-radius:999px;border:1px solid ${error ? "rgba(244,241,235,.7)" : "rgba(244,241,235,.2)"};
    background:rgba(255,255,255,.05);color:#f4f1eb;font-size:17px;text-align:center;letter-spacing:.18em;text-transform:uppercase;outline:none}
  input:focus{border-color:rgba(244,241,235,.6)}
  input::placeholder{letter-spacing:.04em;text-transform:none;color:rgba(244,241,235,.35)}
  button{min-height:52px;border:0;border-radius:999px;background:#f4f1eb;color:#0d0d0e;font-size:15px;font-weight:600;cursor:pointer}
  .err{color:#f4f1eb;font-size:13px;margin-top:4px}
  small{display:block;margin-top:26px;font-size:11.5px;color:rgba(244,241,235,.38)}
</style>
</head>
<body>
<main>
  <img src="/branding/logo-white.png" alt="">
  <h1>SOLANGE</h1>
  <p>Version de démonstration privée.<br>Entre le code d'accès qu'on t'a donné.</p>
  <form method="post" action="/acces">
    <input type="hidden" name="suite" value="${esc(next)}">
    <input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code d'accès" aria-label="Code d'accès" autofocus required${error ? ' aria-invalid="true" aria-describedby="err"' : ""}>
    ${error ? '<span id="err" class="err" role="alert">Ce code ne marche pas. Vérifie-le et réessaie.</span>' : ""}
    <button type="submit">Entrer</button>
  </form>
  <small>Annonces et paiements fictifs · aucune somme n'est débitée</small>
</main>
</body>
</html>`;
}

function html(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("suite"));
  if (!accessCode()) return relativeRedirect(next);
  return html(page(next, false));
}

export async function POST(request: NextRequest) {
  const code = accessCode();
  const form = await request.formData();
  const next = safeNext(String(form.get("suite") ?? "/"));
  if (!code) return relativeRedirect(next, 303);

  if (!sameCode(String(form.get("code") ?? ""), code))
    return html(page(next, true), 401);

  const res = new NextResponse(null, {
    status: 303,
    headers: { location: next, "cache-control": "no-store" },
  });
  res.cookies.set(ACCESS_COOKIE, await accessToken(code), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  return res;
}
