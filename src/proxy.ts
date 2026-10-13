import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessCode, accessToken } from "@/lib/demo-access";

/**
 * Site de démonstration privé : sans le bon cookie, toute page renvoie vers
 * l'écran de code d'accès (/acces). Inactif sans DEMO_ACCESS_CODE.
 */
export async function proxy(request: NextRequest) {
  const code = accessCode();
  if (!code) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessToken(code)))
    return NextResponse.next();

  const from = request.nextUrl.pathname + request.nextUrl.search;
  /* Adresse publique demandée (en-tête Host), pas `request.url` : derrière
     Netlify, ce dernier porte l'adresse interne du déploiement, où le
     cookie posé sur l'adresse publique ne serait pas envoyé. */
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const target = new URL(
    from === "/" ? "/acces" : `/acces?suite=${encodeURIComponent(from)}`,
    host ? `${request.nextUrl.protocol}//${host}` : request.url,
  );
  return NextResponse.redirect(target);
}

export const config = {
  // pages seulement : l'écran d'accès, les fichiers statiques et les
  // images publiques passent sans code
  matcher: [
    "/((?!acces|_next/static|_next/image|img/|video/|branding/|icons/|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|apple-icon|icon).*)",
  ],
};
