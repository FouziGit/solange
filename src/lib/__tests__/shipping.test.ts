import { describe, expect, it } from "vitest";
import {
  relayDraftFor,
  withRelayField,
} from "@/components/checkout/RelayPicker";
import {
  MANUAL_RELAY_ID,
  RELAY_FIELD_MAX,
  RELAY_LABEL_MAX,
  SHIP_OPTIONS,
  isRelayMethod,
  parseManualRelay,
  relayAddressLine,
  relayLabelFor,
  relayPointsNear,
  validateRelay,
} from "../shipping";

describe("validateRelay — contrôle serveur du point relais", () => {
  it("exige un point relais en Mondial Relay et en Point Relais", () => {
    for (const method of ["mondial_relay", "point_relais"]) {
      expect(validateRelay(method, undefined)).toEqual({
        ok: false,
        error: "Choisis un point relais",
      });
      expect(validateRelay(method, "")).toMatchObject({ ok: false });
      expect(validateRelay(method, "   \n ")).toMatchObject({ ok: false });
    }
  });

  it("refuse un libellé qui n'est pas une chaîne", () => {
    expect(validateRelay("mondial_relay", 42)).toMatchObject({ ok: false });
    expect(validateRelay("mondial_relay", { name: "x" })).toMatchObject({
      ok: false,
    });
  });

  it("garde un libellé propre : espaces normalisés, 160 caractères au plus", () => {
    expect(
      validateRelay("point_relais", "  Tabac   de la Gare —\n12 rue X  "),
    ).toEqual({ ok: true, label: "Tabac de la Gare — 12 rue X" });
    const long = validateRelay("mondial_relay", "a".repeat(500));
    expect(long.ok && long.label.length).toBe(RELAY_LABEL_MAX);
  });

  it("ignore un libellé résiduel en livraison à domicile", () => {
    expect(validateRelay("chronopost", "Tabac de la Gare")).toEqual({
      ok: true,
      label: "",
    });
  });

  it("ne réclame rien pour un mode inconnu (barème par défaut)", () => {
    expect(validateRelay("colissimo", undefined)).toEqual({
      ok: true,
      label: "",
    });
  });
});

describe("isRelayMethod", () => {
  it("suit le barème : relais oui, domicile non", () => {
    expect(isRelayMethod("mondial_relay")).toBe(true);
    expect(isRelayMethod("point_relais")).toBe(true);
    expect(isRelayMethod("chronopost")).toBe(false);
    expect(isRelayMethod("")).toBe(false);
    expect(isRelayMethod("toString")).toBe(false);
  });

  it("chaque mode relais a un localisateur officiel en https", () => {
    for (const o of SHIP_OPTIONS) {
      if (o.relay) expect(o.locator).toMatch(/^https:\/\//);
      else expect(o.locator).toBeUndefined();
    }
  });
});

describe("relayLabelFor — libellé lu par le vendeur", () => {
  it("combine nom, adresse, code postal et ville", () => {
    expect(
      relayLabelFor({
        name: "Tabac de la Gare",
        address: "12 rue du Commerce",
        postal: "75011",
        city: "Paris",
      }),
    ).toBe("Tabac de la Gare — 12 rue du Commerce, 75011 Paris");
  });

  it("fonctionne sans ville (points de démo)", () => {
    const [p] = relayPointsNear("75011");
    expect(relayAddressLine(p)).toBe(`${p.address}, 75011`);
    expect(relayLabelFor(p)).toBe(`${p.name} — ${p.address}, 75011`);
  });

  it("des champs à leur longueur maximale tiennent sans couper la ville", () => {
    const label = relayLabelFor({
      name: "N".repeat(RELAY_FIELD_MAX.name),
      address: "A".repeat(RELAY_FIELD_MAX.address),
      postal: "7".repeat(RELAY_FIELD_MAX.postal),
      city: "V".repeat(RELAY_FIELD_MAX.city),
    });
    expect(label.length).toBeLessThanOrEqual(RELAY_LABEL_MAX);
    expect(label.endsWith("V".repeat(RELAY_FIELD_MAX.city))).toBe(true);
    // et le serveur le garde tel quel
    expect(validateRelay("mondial_relay", label)).toEqual({ ok: true, label });
  });
});

describe("parseManualRelay — saisie depuis le localisateur", () => {
  const ok = {
    name: "  Presse du Marché ",
    address: "3  place du Marché",
    postal: "69 001",
    city: "Lyon",
  };

  it("nettoie et renvoie un point relais manuel", () => {
    expect(parseManualRelay(ok)).toEqual({
      ok: true,
      relay: {
        id: MANUAL_RELAY_ID,
        name: "Presse du Marché",
        address: "3 place du Marché",
        postal: "69001",
        city: "Lyon",
      },
    });
  });

  it("désigne le premier champ à corriger, dans l'ordre du formulaire", () => {
    expect(parseManualRelay({ ...ok, name: " " })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(parseManualRelay({ ...ok, address: "" })).toMatchObject({
      ok: false,
      field: "address",
    });
    expect(parseManualRelay({ ...ok, city: "" })).toMatchObject({
      ok: false,
      field: "city",
    });
    expect(
      parseManualRelay({ name: "", address: "", postal: "", city: "" }),
    ).toMatchObject({ ok: false, field: "name" });
  });

  it("exige un code postal de 5 chiffres", () => {
    for (const postal of ["", "7501", "750111", "75O11", "2A004"])
      expect(parseManualRelay({ ...ok, postal })).toMatchObject({
        ok: false,
        field: "postal",
        message: "Le code postal compte 5 chiffres.",
      });
  });

  it("le libellé d'une saisie valide passe le contrôle serveur", () => {
    const r = parseManualRelay(ok);
    if (!r.ok) throw new Error("saisie valide refusée");
    expect(validateRelay("point_relais", relayLabelFor(r.relay))).toEqual({
      ok: true,
      label: "Presse du Marché — 3 place du Marché, 69001 Lyon",
    });
  });
});

describe("saisie manuelle du relais — rangée par transporteur", () => {
  it("un relais Mondial Relay ne réapparaît pas sous « Point Relais »", () => {
    let d = withRelayField({}, "Mondial Relay", "name", "Tabac du Port");
    d = withRelayField(d, "Mondial Relay", "postal", "13002");
    expect(relayDraftFor(d, "Point Relais")).toEqual({
      name: "",
      address: "",
      postal: "",
      city: "",
    });
    expect(parseManualRelay(relayDraftFor(d, "Point Relais")).ok).toBe(false);
  });

  it("revenir au premier transporteur rouvre sa saisie telle quelle", () => {
    let d = withRelayField({}, "Mondial Relay", "name", "Tabac du Port");
    d = withRelayField(d, "Point Relais", "name", "Presse du Marché");
    expect(relayDraftFor(d, "Mondial Relay")).toMatchObject({
      name: "Tabac du Port",
    });
    expect(relayDraftFor(d, "Point Relais")).toMatchObject({
      name: "Presse du Marché",
    });
  });
});
