import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../order-state";
import {
  BUYER_PROTECTION_TEXT,
  FORCED_PAYOUT_STATUSES,
  PAYOUT_DELAYS,
  SELLER_PAYOUT_TEXT,
  SIMULATED_PAYOUT_TEXT,
  adminPayoutRetry,
  classifyPayoutError,
  formatPayoutDate,
  payoutAction,
  payoutAmountCents,
  payoutBase,
  payoutNote,
  type OrderPayout,
  type PayoutInput,
  type PayoutOp,
} from "../payout";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const t0 = 1_780_000_000_000;

/** Commande réelle en versements manuels, payée à t0. */
const order = (over: Partial<PayoutInput> = {}): PayoutInput => ({
  status: "terminee",
  sellerId: "u-vendeur",
  payoutMode: "manual",
  createdAt: t0 - HOUR,
  paidAt: t0,
  ...over,
});

const payout = (over: Partial<OrderPayout> = {}): OrderPayout => ({
  status: "en_attente_fonds",
  amountCents: 9_990,
  attempts: 1,
  createTries: 0,
  lastAttemptAt: t0,
  ...over,
});

describe("PAYOUT_DELAYS", () => {
  it("les délais de D-037", () => {
    expect(PAYOUT_DELAYS).toEqual({
      retryMs: DAY,
      forceAfterPaidMs: 80 * DAY,
      urgentAfterPaidMs: 85 * DAY,
      stripeHoldMaxMs: 90 * DAY,
      disputeLongMs: 7 * DAY,
      alertEveryMs: DAY,
      verifyWindowMs: 15 * DAY,
      verifyEveryMs: DAY,
    });
  });

  it("payoutBase : le paiement, sinon la création", () => {
    expect(payoutBase({ paidAt: t0, createdAt: t0 - DAY })).toBe(t0);
    expect(payoutBase({ createdAt: t0 - DAY })).toBe(t0 - DAY);
  });
});

describe("payoutAction — 1. hors périmètre", () => {
  it("commande seed (sellerId null) : rien", () => {
    expect(payoutAction(order({ sellerId: null }), t0 + DAY)).toEqual({
      kind: "none",
    });
  });

  it("commande antérieure sans payoutMode « manual » : rien", () => {
    expect(payoutAction(order({ payoutMode: undefined }), t0 + DAY)).toEqual({
      kind: "none",
    });
    expect(payoutAction(order({ payoutMode: "auto" }), t0 + DAY)).toEqual({
      kind: "none",
    });
  });

  it("en attente de paiement ou annulée : rien, même à J+85", () => {
    for (const status of ["en_attente", "annulee"] as OrderStatus[])
      expect(payoutAction(order({ status }), t0 + 85 * DAY)).toEqual({
        kind: "none",
      });
  });
});

describe("payoutAction — 2. versement déjà parti", () => {
  it("simulé : rien", () => {
    expect(
      payoutAction(
        order({ payout: payout({ status: "simule", at: t0 }) }),
        t0 + 2 * DAY,
      ),
    ).toEqual({ kind: "none" });
  });

  it("envoyé : une vérification par jour pendant 15 jours", () => {
    const sent = payout({ status: "envoye", id: "po_1", at: t0 });
    expect(payoutAction(order({ payout: sent }), t0 + HOUR)).toEqual({
      kind: "none",
    });
    expect(payoutAction(order({ payout: sent }), t0 + DAY)).toEqual({
      kind: "verify",
    });
    const checked = { ...sent, checkedAt: t0 + DAY };
    expect(payoutAction(order({ payout: checked }), t0 + DAY + HOUR)).toEqual({
      kind: "none",
    });
    expect(payoutAction(order({ payout: checked }), t0 + 2 * DAY)).toEqual({
      kind: "verify",
    });
    expect(
      payoutAction(
        order({ payout: { ...sent, checkedAt: t0 + 14 * DAY } }),
        t0 + 15 * DAY + HOUR,
      ),
    ).toEqual({ kind: "none" });
  });

  it("envoyé (versé d'office) puis litige ouvert depuis 7 jours : l'alerte « long » part quand même, une fois", () => {
    const sent = payout({ status: "envoye", id: "po_1", at: t0 + 80 * DAY });
    const litige = order({
      status: "litige",
      payout: sent,
      dispute: { at: t0 + 81 * DAY },
    });
    expect(payoutAction(litige, t0 + 81 * DAY + HOUR)).toEqual({
      kind: "verify",
    });
    expect(payoutAction(litige, t0 + 88 * DAY)).toEqual({
      kind: "alert_dispute",
      urgency: "long",
      bank: false,
    });
    // alerte posée : retour à la vérification (dans la fenêtre de 15 jours)
    expect(
      payoutAction({ ...litige, disputeAlertAt: t0 + 88 * DAY }, t0 + 89 * DAY),
    ).toEqual({ kind: "verify" });
  });

  it("envoyé : jamais de second versement, même sur contestation", () => {
    const sent = payout({ status: "envoye", id: "po_1", at: t0 });
    expect(
      payoutAction(
        order({ payout: sent, bankDispute: { at: t0 + DAY } }),
        t0 + 20 * DAY,
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("payoutAction — 3. contestation bancaire", () => {
  const bank = { at: t0 + 2 * DAY };

  it("aucun versement, quel que soit le statut", () => {
    for (const status of [
      "terminee",
      "payee",
      "expediee",
      "recue",
      "litige",
    ] as OrderStatus[])
      for (const at of [t0 + DAY, t0 + 80 * DAY, t0 + 86 * DAY])
        expect(
          payoutAction(order({ status, bankDispute: bank }), at).kind,
        ).not.toBe("pay");
  });

  it("avant J+80 : rien", () => {
    expect(payoutAction(order({ bankDispute: bank }), t0 + 79 * DAY)).toEqual({
      kind: "none",
    });
  });

  it("J+80 puis J+85 : alerte, au plus une par jour", () => {
    expect(payoutAction(order({ bankDispute: bank }), t0 + 80 * DAY)).toEqual({
      kind: "alert_dispute",
      urgency: "j80",
      bank: true,
    });
    expect(
      payoutAction(
        order({ bankDispute: bank, disputeAlertAt: t0 + 80 * DAY }),
        t0 + 80 * DAY + HOUR,
      ),
    ).toEqual({ kind: "none" });
    expect(
      payoutAction(
        order({ bankDispute: bank, disputeAlertAt: t0 + 84 * DAY }),
        t0 + 85 * DAY,
      ),
    ).toEqual({ kind: "alert_dispute", urgency: "j85", bank: true });
  });
});

describe("payoutAction — 4. terminée", () => {
  it("premier passage : versement", () => {
    expect(payoutAction(order(), t0 + 10 * DAY)).toEqual({
      kind: "pay",
      forced: false,
      urgent: false,
    });
  });

  it("nouvel essai au plus une fois par jour", () => {
    const o = order({ payout: payout({ lastAttemptAt: t0 + 10 * DAY }) });
    expect(payoutAction(o, t0 + 10 * DAY + HOUR)).toEqual({ kind: "none" });
    expect(payoutAction(o, t0 + 11 * DAY)).toEqual({
      kind: "pay",
      forced: false,
      urgent: false,
    });
    const err = order({
      payout: payout({ status: "erreur", lastAttemptAt: t0 + 10 * DAY }),
    });
    expect(payoutAction(err, t0 + 10 * DAY + HOUR)).toEqual({ kind: "none" });
    expect(payoutAction(err, t0 + 11 * DAY).kind).toBe("pay");
  });

  it("à J+80 le versement devient urgent", () => {
    expect(payoutAction(order(), t0 + 80 * DAY)).toEqual({
      kind: "pay",
      forced: false,
      urgent: true,
    });
  });

  it("sans paidAt, le délai part de la création", () => {
    expect(
      payoutAction(order({ paidAt: undefined, createdAt: t0 }), t0 + 80 * DAY),
    ).toEqual({ kind: "pay", forced: false, urgent: true });
  });
});

describe("payoutAction — 5. expédiée sans litige : versement d'office à J+80", () => {
  it("statuts concernés : expédiée et reçue, jamais payée ni en litige", () => {
    expect(FORCED_PAYOUT_STATUSES).toEqual(["expediee", "recue"]);
  });

  it("rien avant J+80", () => {
    for (const status of ["payee", "expediee", "recue"] as OrderStatus[])
      expect(payoutAction(order({ status }), t0 + 80 * DAY - 1)).toEqual({
        kind: "none",
      });
  });

  it("payée, jamais expédiée : aucun versement d'office, même à J+89", () => {
    // l'annulation J+7 a échoué (remboursement refusé) : payer le vendeur
    // d'une pièce jamais partie serait l'inverse de ce qu'il faut
    for (const at of [t0 + 80 * DAY, t0 + 85 * DAY, t0 + 89 * DAY])
      expect(payoutAction(order({ status: "payee" }), at)).toEqual({
        kind: "none",
      });
  });

  it("forcé à J+80, un essai par jour", () => {
    for (const status of ["expediee", "recue"] as OrderStatus[]) {
      expect(payoutAction(order({ status }), t0 + 80 * DAY)).toEqual({
        kind: "pay",
        forced: true,
        urgent: true,
      });
      const tried = order({
        status,
        payout: payout({ lastAttemptAt: t0 + 80 * DAY }),
      });
      expect(payoutAction(tried, t0 + 80 * DAY + HOUR)).toEqual({
        kind: "none",
      });
      expect(payoutAction(tried, t0 + 81 * DAY).kind).toBe("pay");
    }
  });
});

describe("payoutAction — 6. litige", () => {
  const litige = (over: Partial<PayoutInput> = {}) =>
    order({ status: "litige", dispute: { at: t0 + 10 * DAY }, ...over });

  it("jamais de versement", () => {
    for (const at of [t0 + DAY, t0 + 80 * DAY, t0 + 89 * DAY])
      expect(payoutAction(litige(), at).kind).not.toBe("pay");
  });

  it("ouvert depuis 7 jours : une seule alerte « long »", () => {
    expect(payoutAction(litige(), t0 + 17 * DAY - 1)).toEqual({
      kind: "none",
    });
    expect(payoutAction(litige(), t0 + 17 * DAY)).toEqual({
      kind: "alert_dispute",
      urgency: "long",
      bank: false,
    });
    expect(
      payoutAction(litige({ disputeAlertAt: t0 + 17 * DAY }), t0 + 30 * DAY),
    ).toEqual({ kind: "none" });
  });

  it("J+80 : alerte quotidienne, J+85 : URGENT", () => {
    const alerted = litige({ disputeAlertAt: t0 + 17 * DAY });
    expect(payoutAction(alerted, t0 + 80 * DAY)).toEqual({
      kind: "alert_dispute",
      urgency: "j80",
      bank: false,
    });
    const today = litige({ disputeAlertAt: t0 + 80 * DAY });
    expect(payoutAction(today, t0 + 80 * DAY + HOUR)).toEqual({
      kind: "none",
    });
    expect(payoutAction(today, t0 + 81 * DAY)).toEqual({
      kind: "alert_dispute",
      urgency: "j80",
      bank: false,
    });
    expect(
      payoutAction(litige({ disputeAlertAt: t0 + 84 * DAY }), t0 + 85 * DAY),
    ).toEqual({ kind: "alert_dispute", urgency: "j85", bank: false });
  });
});

describe("adminPayoutRetry — le bouton « Réessayer » ne ment pas", () => {
  it("terminée : relance normale", () => {
    expect(adminPayoutRetry(order(), t0 + DAY)).toEqual({
      ok: true,
      force: false,
    });
  });

  it("expédiée ou reçue : versement d'office à partir de J+80 seulement", () => {
    for (const status of ["expediee", "recue"] as OrderStatus[]) {
      expect(adminPayoutRetry(order({ status }), t0 + 79 * DAY)).toEqual({
        ok: false,
        force: false,
      });
      expect(adminPayoutRetry(order({ status }), t0 + 80 * DAY)).toEqual({
        ok: true,
        force: true,
      });
    }
  });

  it("payée, litige, annulée, en attente : rien à relancer, même tard", () => {
    for (const status of [
      "payee",
      "litige",
      "annulee",
      "en_attente",
    ] as OrderStatus[])
      expect(adminPayoutRetry(order({ status }), t0 + 85 * DAY)).toEqual({
        ok: false,
        force: false,
      });
  });
});

describe("payoutAmountCents", () => {
  it("sellerCents entier et positif en priorité", () => {
    expect(payoutAmountCents({ sellerCents: 9_990, netSellerEUR: 1 })).toBe(
      9_990,
    );
  });

  it("sinon netSellerEUR arrondi au centime", () => {
    expect(payoutAmountCents({ netSellerEUR: 99.9 })).toBe(9_990);
    expect(payoutAmountCents({ sellerCents: 12.5, netSellerEUR: 10.01 })).toBe(
      1_001,
    );
    expect(payoutAmountCents({ sellerCents: 0, netSellerEUR: 5 })).toBe(500);
  });

  it("montant introuvable → 0", () => {
    for (const o of [
      {},
      { sellerCents: -5 },
      { sellerCents: "9990" },
      { netSellerEUR: 0 },
      { netSellerEUR: -3 },
      { netSellerEUR: Number.NaN },
      { netSellerEUR: "12" },
      { netSellerEUR: 0.004 },
    ])
      expect(payoutAmountCents(o)).toBe(0);
  });
});

describe("classifyPayoutError — erreurs du SDK Stripe", () => {
  it("requête concurrente sur la même clé : concurrent", () => {
    for (const e of [
      { type: "StripeIdempotencyError", message: "Keys for idempotent…" },
      { rawType: "idempotency_error" },
      { statusCode: 409, message: "conflict" },
    ])
      expect(classifyPayoutError(e, "payout")).toEqual({
        kind: "concurrent",
        message: "Versement déjà en cours de traitement",
      });
  });

  it("solde insuffisant : fonds", () => {
    expect(
      classifyPayoutError(
        { code: "balance_insufficient", statusCode: 400 },
        "payout",
      ),
    ).toEqual({
      kind: "fonds",
      message: "Fonds pas encore disponibles chez Stripe",
    });
  });

  it("versements désactivés : compte", () => {
    expect(
      classifyPayoutError(
        { code: "payouts_not_allowed", statusCode: 400 },
        "payout",
      ),
    ).toEqual({
      kind: "compte",
      message:
        "Versements désactivés sur le compte Stripe du vendeur (inscription à compléter)",
    });
  });

  it("clé restreinte : la permission à ajouter dépend de l'appel", () => {
    const expected: Record<PayoutOp, string> = {
      schedule: "Connect › Accounts (écriture)",
      balance: "Balance (lecture)",
      read: "Connect › Payouts (lecture)",
      payout: "Connect › Payouts (écriture)",
    };
    for (const op of Object.keys(expected) as PayoutOp[]) {
      const r = classifyPayoutError(
        {
          type: "StripePermissionError",
          statusCode: 403,
          message: "The provided key does not have the required permissions",
        },
        op,
      );
      expect(r.kind).toBe("permission");
      expect(r.message).toBe(
        `Clé Stripe restreinte sans l'autorisation nécessaire : ajouter ${expected[op]}. Détail Stripe : The provided key does not have the required permissions`,
      );
    }
    expect(classifyPayoutError({ statusCode: 403 }, "read").kind).toBe(
      "permission",
    );
    expect(
      classifyPayoutError({ message: "Missing PERMISSION rak_x" }, "balance")
        .kind,
    ).toBe("permission");
  });

  it("détail Stripe tronqué à 200 caractères pour une permission", () => {
    const r = classifyPayoutError(
      { statusCode: 403, message: "x".repeat(500) },
      "payout",
    );
    expect(r.message.endsWith(`Détail Stripe : ${"x".repeat(200)}`)).toBe(true);
  });

  it("autre : message Stripe tronqué à 300 caractères", () => {
    expect(
      classifyPayoutError({ statusCode: 500, message: "boom" }, "payout"),
    ).toEqual({ kind: "autre", message: "boom" });
    expect(
      classifyPayoutError({ message: "y".repeat(500) }, "payout").message,
    ).toBe("y".repeat(300));
    const empty = classifyPayoutError({}, "payout");
    expect(empty.kind).toBe("autre");
    expect(empty.message.length).toBeGreaterThan(0);
  });

  it("concurrent l'emporte sur les autres signaux", () => {
    expect(
      classifyPayoutError(
        { statusCode: 409, code: "balance_insufficient" },
        "payout",
      ).kind,
    ).toBe("concurrent");
  });
});

describe("formatPayoutDate — heure de Paris", () => {
  it("date longue en français", () => {
    expect(formatPayoutDate(Date.UTC(2026, 8, 28, 10, 0))).toBe(
      "28 septembre 2026",
    );
  });

  it("22 h 30 UTC le 28 = déjà le 29 à Paris (heure d'été)", () => {
    expect(formatPayoutDate(Date.UTC(2026, 8, 28, 22, 30))).toBe(
      "29 septembre 2026",
    );
  });
});

describe("payoutNote — page commande", () => {
  type NoteInput = Parameters<typeof payoutNote>[0];
  const note = (over: Partial<NoteInput> = {}): NoteInput => ({
    status: "expediee",
    payoutMode: "manual",
    ...over,
  });
  const both = (o: NoteInput) => ({
    buyer: payoutNote(o, "buyer"),
    seller: payoutNote(o, "seller"),
  });

  it("annulée ou commande antérieure : rien", () => {
    expect(both(note({ status: "annulee", lostParcel: { at: t0 } }))).toEqual({
      buyer: null,
      seller: null,
    });
    for (const payoutMode of [undefined, "auto"])
      for (const status of [
        "payee",
        "expediee",
        "terminee",
        "litige",
      ] as OrderStatus[])
        expect(both(note({ status, payoutMode }))).toEqual({
          buyer: null,
          seller: null,
        });
  });

  it("contestation bancaire sans versement : suspendu (vendeur seulement)", () => {
    for (const p of [undefined, payout(), payout({ status: "erreur" })])
      expect(
        both(note({ status: "terminee", payout: p, bankDispute: { at: t0 } })),
      ).toEqual({
        buyer: null,
        seller:
          "Ton virement est suspendu : l'acheteur a contesté le paiement auprès de sa banque. L'équipe te tient au courant.",
      });
  });

  it("contestation après un versement envoyé : la date du virement reste", () => {
    const at = Date.UTC(2026, 8, 28, 10, 0);
    expect(
      both(
        note({
          status: "terminee",
          payout: payout({ status: "envoye", at }),
          bankDispute: { at: at + DAY },
        }),
      ),
    ).toEqual({ buyer: null, seller: "Virement envoyé le 28 septembre 2026" });
  });

  it("versement envoyé, simulé, en attente de fonds, en erreur", () => {
    const at = Date.UTC(2026, 8, 28, 10, 0);
    const cases: [OrderPayout, string][] = [
      [
        payout({ status: "envoye", at }),
        "Virement envoyé le 28 septembre 2026",
      ],
      [payout({ status: "simule", at }), "Virement simulé (démonstration)"],
      [
        payout({ status: "en_attente_fonds" }),
        "Ta part est prête : le virement part dès que Stripe rend les fonds disponibles. On réessaie chaque jour.",
      ],
      [
        payout({ status: "erreur" }),
        "Virement retardé : l'équipe est prévenue et s'en occupe.",
      ],
    ];
    for (const [p, seller] of cases)
      expect(both(note({ status: "terminee", payout: p }))).toEqual({
        buyer: null,
        seller,
      });
  });

  it("terminée sans versement : en préparation", () => {
    expect(both(note({ status: "terminee" }))).toEqual({
      buyer: null,
      seller: "Virement en préparation",
    });
  });

  it("litige : le vendeur attend, l'acheteur est protégé", () => {
    expect(both(note({ status: "litige" }))).toEqual({
      buyer: BUYER_PROTECTION_TEXT,
      seller: "Ton virement attend la décision de l'équipe.",
    });
  });

  it("payée, expédiée, reçue : protection acheteur, calendrier vendeur", () => {
    for (const status of ["payee", "expediee", "recue"] as OrderStatus[])
      expect(both(note({ status }))).toEqual({
        buyer: BUYER_PROTECTION_TEXT,
        seller: SELLER_PAYOUT_TEXT,
      });
  });

  it("commande simulée sans versement : texte de démonstration (vendeur), rien côté acheteur", () => {
    for (const status of [
      "payee",
      "expediee",
      "recue",
      "litige",
      "terminee",
    ] as OrderStatus[])
      expect(both(note({ status, simulated: true }))).toEqual({
        buyer: null,
        seller: SIMULATED_PAYOUT_TEXT,
      });
    // versement simulé noté : il reste affiché
    expect(
      both(
        note({
          status: "terminee",
          simulated: true,
          payout: payout({ status: "simule", at: t0 }),
        }),
      ),
    ).toEqual({ buyer: null, seller: "Virement simulé (démonstration)" });
    expect(SIMULATED_PAYOUT_TEXT).toBe(
      "Paiement simulé (démonstration) : aucun virement réel n'aura lieu.",
    );
  });

  it("en attente de paiement : rien", () => {
    expect(both(note({ status: "en_attente" }))).toEqual({
      buyer: null,
      seller: null,
    });
  });

  it("textes de référence", () => {
    // aligné sur CGV 12.5 : la clôture J+14 paie aussi le vendeur
    expect(BUYER_PROTECTION_TEXT).toBe(
      "Ton paiement est protégé : le vendeur n'est payé qu'après la réception, que tu la confirmes ou que 14 jours passent après l'expédition sans problème signalé de ta part.",
    );
    expect(BUYER_PROTECTION_TEXT).not.toMatch(/que lorsque tu confirmes/);
    expect(SELLER_PAYOUT_TEXT).toBe(
      "Tu es payé dès que l'acheteur confirme la réception, ou 14 jours après l'expédition sans problème signalé.",
    );
    expect(`${BUYER_PROTECTION_TEXT} ${SELLER_PAYOUT_TEXT}`).not.toMatch(
      /séquestre|vendredi/i,
    );
  });
});
