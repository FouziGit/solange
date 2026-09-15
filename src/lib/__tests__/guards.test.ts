import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  handleCandidates,
  isPayableAmount,
  isValidId,
  isVisible,
  lookupOwn,
} from "../guards";

describe("lookupOwn — le trou par lequel un total partait à zéro", () => {
  const SHIP = {
    mondial_relay: { price: 3.9, carrier: "Mondial Relay" },
    chronopost: { price: 6.9, carrier: "Chronopost" },
  };
  const defaut = { price: 4.9, carrier: "Livraison suivie" };

  it("rend la valeur quand la clé est réellement posée", () => {
    expect(lookupOwn(SHIP, "chronopost", defaut).price).toBe(6.9);
  });

  it("refuse les membres hérités — c'était le bug", () => {
    for (const piege of ["constructor", "__proto__", "toString", "valueOf"]) {
      expect(lookupOwn(SHIP, piege, defaut)).toBe(defaut);
    }
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    expect(lookupOwn(SHIP, null, defaut)).toBe(defaut);
    expect(lookupOwn(SHIP, 42, defaut)).toBe(defaut);
    expect(lookupOwn(SHIP, undefined, defaut)).toBe(defaut);
  });

  it("un prix issu du repli reste un nombre fini — plus de NaN en aval", () => {
    const sel = lookupOwn(SHIP, "constructor", defaut);
    expect(Number.isFinite(sel.price)).toBe(true);
  });
});

describe("isPayableAmount — le dernier filet avant le paiement", () => {
  it("refuse NaN, l'infini, zéro et le négatif", () => {
    for (const v of [NaN, Infinity, -Infinity, 0, -1]) {
      expect(isPayableAmount(v)).toBe(false);
    }
  });
  it("refuse ce qui n'est pas un nombre", () => {
    expect(isPayableAmount("42")).toBe(false);
    expect(isPayableAmount(null)).toBe(false);
  });
  it("accepte un montant réel", () => {
    expect(isPayableAmount(129.9)).toBe(true);
    expect(isPayableAmount(0.01)).toBe(true);
  });
});

describe("isValidId", () => {
  it("accepte les identifiants du produit", () => {
    expect(isValidId("p_9f3a1c")).toBe(true);
    expect(isValidId("k15")).toBe(true);
  });
  it("refuse ce qui pourrait déformer une clé de stockage", () => {
    for (const v of ["", "a/b", "a b", "../x", "a:b\nc", "é", "a".repeat(81)]) {
      expect(isValidId(v)).toBe(false);
    }
  });
  it("refuse ce qui n'est pas une chaîne", () => {
    expect(isValidId(null)).toBe(false);
    expect(isValidId(12)).toBe(false);
  });
});

describe("handleCandidates — un pseudo n'est jamais réattribué", () => {
  it("propose d'abord le pseudo souhaité", () => {
    expect(handleCandidates("lou", "u_abc")[0]).toBe("lou");
  });

  it("finit TOUJOURS par un candidat unique par construction", () => {
    const l = handleCandidates("lou", "u_abc");
    expect(l[l.length - 1]).toBe("membre-abc");
  });

  it("ne propose jamais deux fois le même", () => {
    const l = handleCandidates("lou", "u_abc");
    expect(new Set(l).size).toBe(l.length);
  });

  it("tient même si la base est vide", () => {
    const l = handleCandidates("", "u_xyz");
    expect(l[0]).toBe("membre");
    expect(l[l.length - 1]).toBe("membre-xyz");
  });

  it("deux comptes différents ne partagent jamais leur dernier recours", () => {
    const a = handleCandidates("lou", "u_aaa");
    const b = handleCandidates("lou", "u_bbb");
    expect(a[a.length - 1]).not.toBe(b[b.length - 1]);
  });
});

describe("escapeHtml — ce qui part dans un e-mail de signalement", () => {
  it("neutralise une balise", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
  it("neutralise une sortie d'attribut", () => {
    expect(escapeHtml('" onload="x')).toBe("&quot; onload=&quot;x");
  });
  it("échappe l'esperluette en premier, sans double échappement", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
  it("supporte l'absence de valeur", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("isVisible — une sanction vaut sur toutes les surfaces", () => {
  it("masque ce que la modération a masqué", () => {
    expect(isVisible({ hidden: true })).toBe(false);
  });
  it("masque les enregistrements fantômes", () => {
    expect(isVisible({ shadow: true })).toBe(false);
  });
  it("laisse passer le reste", () => {
    expect(isVisible({ sellerId: "u_1" })).toBe(true);
  });
  it("traite l'absence comme invisible", () => {
    expect(isVisible(null)).toBe(false);
  });
});
