import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../core.mts";

/* Le pied des e-mails transactionnels suit le mode de paiement, lu à la
   même source que /api/payments/config (STRIPE_SECRET_KEY). Il disait
   « paiements simulés » en dur, y compris sous le « Vendu » envoyé au
   vendeur après un vrai paiement Stripe. On vérifie le HTML réellement
   envoyé à Resend, sans réseau. */

async function htmlEnvoye(stripeKey: string): Promise<string> {
  vi.stubEnv("STRIPE_SECRET_KEY", stripeKey);
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await sendEmail("vendeur@example.com", "Vendu", "<p>Corps du message</p>");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const init = fetchMock.mock.calls[0][1];
  return (JSON.parse(String(init?.body)) as { html: string }).html;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendEmail — pied selon le mode de paiement", () => {
  it("paiement réel (clé live) : jamais « paiements simulés »", async () => {
    const html = await htmlEnvoye("sk_live_exemple");
    expect(html).not.toMatch(/simulé/i);
    expect(html).not.toMatch(/démonstration/i);
    expect(html).toContain("Paiement par carte, via Stripe");
    expect(html).toContain("<p>Corps du message</p>");
  });

  it("clé de test : le parcours passe par Stripe, pas de « simulés »", async () => {
    const html = await htmlEnvoye("sk_test_exemple");
    expect(html).not.toMatch(/simulé/i);
    expect(html).toContain("Paiement par carte, via Stripe");
  });

  it("paiement réel coupé (aucune clé) : la mention « simulés » reste", async () => {
    const html = await htmlEnvoye("");
    expect(html).toContain("Beta · démonstration — paiements simulés");
    expect(html).not.toContain("via Stripe");
    expect(html).toContain("<p>Corps du message</p>");
  });
});
