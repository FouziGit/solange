import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAYMENTS_UNKNOWN, type PaymentsMode } from "../use-payments-mode";
import { LEGAL_DOCS, paymentsClaim } from "../legal";
import { stripComments } from "../markdown";

describe("paymentsClaim", () => {
  it("n'affirme rien tant que le serveur n'a pas répondu", () => {
    expect(paymentsClaim(PAYMENTS_UNKNOWN)).toBeNull();
  });

  it("n'affirme rien après un échec, même si live vaut false", () => {
    const echec: PaymentsMode = { ...PAYMENTS_UNKNOWN, failed: true };
    expect(paymentsClaim(echec)).toBeNull();
  });

  it("« simulé » seulement quand le serveur dit que le paiement est coupé", () => {
    expect(paymentsClaim({ ready: true, live: false })).toBe("simule");
  });

  it("paiement réel, clé live ou clé de test : Stripe", () => {
    expect(paymentsClaim({ ready: true, live: true })).toBe("stripe");
    const test: PaymentsMode = {
      ready: true,
      live: true,
      test: true,
      failed: false,
    };
    expect(paymentsClaim(test)).toBe("stripe");
  });
});

describe("registre des documents", () => {
  it("aucun résumé n'affirme que le paiement est simulé", () => {
    for (const d of LEGAL_DOCS) expect(d.summary).not.toMatch(/simul/i);
  });

  it("CGV art. 12 : la date d'activation est renseignée", () => {
    const cgv = readFileSync(
      path.resolve(__dirname, "../../../legal/cgv.md"),
      "utf8",
    );
    const ligne = cgv.split("\n").find((l) => l.includes("Date d'activation"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain("24 septembre 2026");
    expect(ligne).not.toContain("[À COMPLÉTER");
  });

  /* Le paiement réel est actif : aucun texte légal ne peut encore
     AFFIRMER que les paiements sont simulés. Une phrase conditionnelle
     (« tant que les paiements sont simulés… ») reste admise. On lit ce
     que voit le lecteur (réserves en commentaire retirées, comme au
     rendu), retours à la ligne aplatis : la phrase peut être coupée. */
  it("aucun document n'affirme que les paiements sont simulés", () => {
    for (const d of LEGAL_DOCS) {
      const texte = stripComments(
        readFileSync(
          path.resolve(__dirname, `../../../legal/${d.slug}.md`),
          "utf8",
        ),
      ).replace(/\s+/g, " ");
      expect(texte, d.slug).not.toMatch(
        /(?<!tant que )les paiements (?:y )?sont simulés/i,
      );
      expect(texte, d.slug).not.toMatch(/aucune somme n'est débitée/i);
    }
  });
});
