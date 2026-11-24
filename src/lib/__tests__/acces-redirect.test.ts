import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/acces/route";

/* /acces ne doit jamais renvoyer vers un autre site. Un navigateur lit
   « /\site » et « /<tab>/site » comme « //site » : un lien qui commence par
   l'adresse de SOLANGE menait ainsi n'importe où (hameçonnage). On vérifie
   l'en-tête Location réellement renvoyé. */

const SITE = "https://solange.test";
const CODE = "PENDERIE";

/** Où un navigateur irait vraiment en suivant cette redirection. */
function destination(res: Response): string {
  return new URL(res.headers.get("location") ?? "", SITE).origin;
}

function envoi(suite: string, code = CODE) {
  const body = new URLSearchParams({ suite, code });
  return POST(
    new NextRequest(`${SITE}/acces`, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("/acces sans code configuré (production)", () => {
  it("renvoie à l'accueil, sans lire « suite »", async () => {
    const res = await GET(
      new NextRequest(
        `${SITE}/acces?suite=${encodeURIComponent("/\\example.com")}`,
      ),
    );
    expect(res.headers.get("location")).toBe("/");
  });

  it("renvoie à l'accueil aussi à l'envoi du formulaire", async () => {
    const res = await envoi("/\\example.com");
    expect(res.headers.get("location")).toBe("/");
  });
});

describe("/acces avec code (site de démonstration)", () => {
  it.each(["/\\example.com", "/\t/example.com", "//example.com"])(
    "bon code + suite « %s » : on reste sur le site",
    async (suite) => {
      vi.stubEnv("DEMO_ACCESS_CODE", CODE);
      const res = await envoi(suite);
      expect(res.status).toBe(303);
      expect(destination(res)).toBe(SITE);
    },
  );

  it("bon code + page du site : on y retourne, paramètres compris", async () => {
    vi.stubEnv("DEMO_ACCESS_CODE", CODE);
    const res = await envoi("/decouvrir?q=margiela");
    expect(res.headers.get("location")).toBe("/decouvrir?q=margiela");
  });
});
