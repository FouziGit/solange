import { describe, expect, it } from "vitest";
import {
  DELAYS,
  dueActions,
  nextStatus,
  normalizeStatus,
  type OrderRole,
  type OrderStatus,
} from "../order-state";

describe("normalizeStatus (migration en lecture)", () => {
  it("mappe l'ancien vocabulaire vers le nouveau sans réécriture", () => {
    expect(normalizeStatus("confirmee")).toBe("payee");
    expect(normalizeStatus(undefined)).toBe("payee");
    expect(normalizeStatus("expediee")).toBe("expediee");
    expect(normalizeStatus("litige")).toBe("litige");
  });
});

describe("nextStatus — permissions par rôle", () => {
  it("le vendeur expédie, personne d'autre", () => {
    expect(nextStatus("payee", "ship", "seller")).toBe("expediee");
    for (const r of ["buyer", "system", "admin"] as OrderRole[])
      expect(nextStatus("payee", "ship", r)).toBeNull();
  });

  it("l'acheteur reçoit et conteste, personne d'autre", () => {
    expect(nextStatus("expediee", "receive", "buyer")).toBe("recue");
    expect(nextStatus("expediee", "receive", "seller")).toBeNull();
    expect(nextStatus("expediee", "dispute", "buyer")).toBe("litige");
    expect(nextStatus("recue", "dispute", "buyer")).toBe("litige");
    expect(nextStatus("recue", "dispute", "seller")).toBeNull();
  });

  it("l'annulation avant expédition : vendeur ou système, jamais après envoi", () => {
    expect(nextStatus("payee", "cancel", "seller")).toBe("annulee");
    expect(nextStatus("payee", "cancel", "system")).toBe("annulee");
    expect(nextStatus("payee", "cancel", "buyer")).toBeNull();
    expect(nextStatus("expediee", "cancel", "seller")).toBeNull();
  });

  it("la clôture : système uniquement", () => {
    expect(nextStatus("recue", "close", "system")).toBe("terminee");
    expect(nextStatus("expediee", "close", "system")).toBe("terminee");
    expect(nextStatus("recue", "close", "buyer")).toBeNull();
  });

  it("le litige n'est tranché que par un admin (lot 4)", () => {
    expect(nextStatus("litige", "resolve_cancel", "admin")).toBe("annulee");
    expect(nextStatus("litige", "resolve_close", "admin")).toBe("terminee");
    expect(nextStatus("litige", "resolve_close", "seller")).toBeNull();
    expect(nextStatus("litige", "close", "system")).toBeNull();
  });

  it("aucune transition depuis un état final", () => {
    for (const s of ["terminee", "annulee"] as OrderStatus[]) {
      expect(nextStatus(s, "ship", "seller")).toBeNull();
      expect(nextStatus(s, "receive", "buyer")).toBeNull();
      expect(nextStatus(s, "cancel", "system")).toBeNull();
    }
  });
});

describe("dueActions — automatismes (horloge injectée, idempotents)", () => {
  const t0 = 1_700_000_000_000;

  it("rappelle le vendeur à J+3, une seule fois", () => {
    const o = { status: "payee" as const, createdAt: t0 };
    expect(dueActions(o, t0 + DELAYS.remindShipMs - 1)).toEqual([]);
    expect(dueActions(o, t0 + DELAYS.remindShipMs)).toEqual(["remind_ship"]);
    expect(
      dueActions({ ...o, remindShipAt: t0 }, t0 + DELAYS.remindShipMs),
    ).toEqual([]);
  });

  it("annule à J+7 sans expédition (prioritaire sur le rappel)", () => {
    const o = { status: "payee" as const, createdAt: t0 };
    expect(dueActions(o, t0 + DELAYS.autoCancelMs)).toEqual(["auto_cancel"]);
  });

  it("après expédition : rappel J+7, clôture J+14", () => {
    const o = {
      status: "expediee" as const,
      createdAt: t0,
      shippedAt: t0,
    };
    expect(dueActions(o, t0 + DELAYS.remindReceiveMs)).toEqual([
      "remind_receive",
    ]);
    expect(dueActions(o, t0 + DELAYS.autoCloseMs)).toEqual(["auto_close"]);
  });

  it("un litige gèle tout", () => {
    expect(
      dueActions(
        { status: "litige", createdAt: t0, shippedAt: t0 },
        t0 + DELAYS.autoCloseMs * 2,
      ),
    ).toEqual([]);
  });
});
