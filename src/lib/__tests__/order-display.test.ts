import { describe, expect, it } from "vitest";
import { paymentNote, stepState } from "../order-display";
import { TIMELINE } from "../order-state";

describe("stepState — frise de commande", () => {
  it("les étapes passées sont franchies, celle du statut est l'actuelle", () => {
    expect(TIMELINE.map((s) => stepState("recue", s))).toEqual([
      "franchie",
      "franchie",
      "actuelle",
      "a_venir",
    ]);
  });

  it("payée : première étape actuelle, le reste à venir", () => {
    expect(TIMELINE.map((s) => stepState("payee", s))).toEqual([
      "actuelle",
      "a_venir",
      "a_venir",
      "a_venir",
    ]);
  });

  it("terminée : dernière étape actuelle, toutes les autres franchies", () => {
    expect(TIMELINE.map((s) => stepState("terminee", s))).toEqual([
      "franchie",
      "franchie",
      "franchie",
      "actuelle",
    ]);
  });

  it("en attente de paiement : rien n'est acquis", () => {
    for (const s of TIMELINE) expect(stepState("en_attente", s)).toBe("a_venir");
  });

  it("annulée ou en litige : la frise s'arrête, aucune étape acquise", () => {
    for (const s of TIMELINE) {
      expect(stepState("annulee", s)).toBe("a_venir");
      expect(stepState("litige", s)).toBe("a_venir");
    }
  });

  it("une étape hors frise n'est jamais franchie", () => {
    expect(stepState("terminee", "litige")).toBe("a_venir");
  });
});

describe("paymentNote — jamais « simulé » quand le paiement est réel", () => {
  const live = { ready: true, live: true };
  const demo = { ready: true, live: false };
  const inconnu = { ready: false, live: false };

  it("carte connue : ses 4 derniers chiffres, quel que soit le mode", () => {
    expect(paymentNote("4242", live)).toBe("carte •••• 4242");
    expect(paymentNote("4242", demo)).toBe("carte •••• 4242");
    expect(paymentNote("4242", inconnu)).toBe("carte •••• 4242");
  });

  it("paiement réel actif : aucune mention de simulation", () => {
    expect(paymentNote("démo", live)).toBeNull();
  });

  it("mode encore inconnu (chargement, hors ligne) : on n'affirme rien", () => {
    expect(paymentNote("démo", inconnu)).toBeNull();
  });

  it("paiement réel coupé, confirmé par le serveur : « paiement simulé »", () => {
    expect(paymentNote("démo", demo)).toBe("paiement simulé (démo)");
  });

  it("un last4 qui n'est pas 4 chiffres n'est pas une carte", () => {
    expect(paymentNote("424", live)).toBeNull();
    expect(paymentNote("42424", demo)).toBe("paiement simulé (démo)");
  });
});
