/* ============================================================
   Code d'accès du site de démonstration.

   Actif seulement si la variable serveur DEMO_ACCESS_CODE est posée (site
   Netlify de démo). Sans elle — production, développement — rien ne
   change. Le code n'est jamais envoyé au navigateur : on y dépose un
   cookie httpOnly qui en contient l'empreinte, vérifiée par src/proxy.ts.
   ============================================================ */

export const ACCESS_COOKIE = "solange_demo_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

export function accessCode(): string | undefined {
  const c = process.env.DEMO_ACCESS_CODE?.trim();
  return c ? c : undefined;
}

/** Redirection RELATIVE : derrière Netlify, `request.url` porte l'adresse
    interne du déploiement (<id>--site.netlify.app). Y renvoyer ferait
    perdre le cookie posé sur l'adresse publique. */
export function relativeRedirect(location: string, status = 307): Response {
  return new Response(null, {
    status,
    headers: { location, "cache-control": "no-store" },
  });
}

/** Empreinte SHA-256 (hex) du code — ce que porte le cookie. */
export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`solange-demo:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Normalise la saisie : la casse, les espaces et les tirets ne comptent pas. */
export function sameCode(input: string, code: string): boolean {
  const n = (s: string) => s.replace(/[\s-]+/g, "").toUpperCase();
  return n(input) === n(code);
}
