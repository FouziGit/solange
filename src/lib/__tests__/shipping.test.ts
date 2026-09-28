import { describe, expect, it } from "vitest";
import {
  relayDraftFor,
  withRelayField,
} from "@/components/checkout/RelayPicker";
import {
  CARRIERS,
  DEFAULT_PACKAGE_SIZE,
  MANUAL_RELAY_ID,
  PACKAGE_SIZES,
  PACKAGE_WEIGH_HINT,
  RELAY_FIELD_MAX,
  RELAY_LABEL_MAX,
  SHIPPING_GRID_CENTS,
  SHIPPING_GRID_SOURCE,
  SHIP_OPTIONS,
  TRACKING_MAX,
  TRACKING_MIN,
  carrierOfOrder,
  isPackageSize,
  isRelayMethod,
  isShipMethod,
  packageSize,
  packageSizeOf,
  parseManualRelay,
  relayAddressLine,
  relayLabelFor,
  relayPointsNear,
  shipMethodLabel,
  shipOption,
  shippingCents,
  shippingFromCents,
  validateRelay,
  validateTracking,
  weightLabel,
  type PackageSizeId,
  type ShipMethodId,
} from "../shipping";

const RELAY_METHODS = SHIP_OPTIONS.filter((o) => o.relay).map((o) => o.id);

describe("validateRelay — contrôle serveur du point relais", () => {
  it("exige un point relais pour chaque mode relais (Point Relais ou Locker)", () => {
    expect(RELAY_METHODS).toEqual(["mondial_relay"]);
    for (const method of RELAY_METHODS) {
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
      validateRelay("mondial_relay", "  Tabac   de la Gare —\n12 rue X  "),
    ).toEqual({ ok: true, label: "Tabac de la Gare — 12 rue X" });
    const long = validateRelay("mondial_relay", "a".repeat(500));
    expect(long.ok && long.label.length).toBe(RELAY_LABEL_MAX);
  });

  it("ignore un libellé résiduel en livraison à domicile", () => {
    expect(validateRelay("mondial_relay_domicile", "Tabac de la Gare")).toEqual(
      {
        ok: true,
        label: "",
      },
    );
  });

  it("ne réclame rien pour un mode inconnu (refusé en amont par isShipMethod)", () => {
    for (const method of ["colissimo", "chronopost", "point_relais"]) {
      expect(validateRelay(method, undefined)).toEqual({
        ok: true,
        label: "",
      });
      expect(isShipMethod(method)).toBe(false);
    }
  });
});

describe("isRelayMethod", () => {
  it("suit le barème : relais oui, domicile non", () => {
    expect(isRelayMethod("mondial_relay")).toBe(true);
    expect(isRelayMethod("mondial_relay_domicile")).toBe(false);
    // anciens modes retirés : désormais inconnus
    expect(isRelayMethod("point_relais")).toBe(false);
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
    expect(validateRelay("mondial_relay", relayLabelFor(r.relay))).toEqual({
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

describe("tailles de colis — choisies par le vendeur, figées", () => {
  const IDS: PackageSizeId[] = ["petit", "moyen", "grand", "tres_grand"];

  it("quatre tailles, poids maximal croissant, « Moyen » par défaut", () => {
    expect(PACKAGE_SIZES.map((s) => s.id)).toEqual(IDS);
    expect(PACKAGE_SIZES.map((s) => s.maxWeightG)).toEqual([
      500, 1000, 2000, 4000,
    ]);
    expect(DEFAULT_PACKAGE_SIZE).toBe("moyen");
    for (const id of IDS) expect(packageSize(id).id).toBe(id);
    expect(packageSize("tres_grand").label).toBe("Très grand");
  });

  it("l'aide de pesée dit que la taille ne se change plus", () => {
    expect(PACKAGE_WEIGH_HINT).toMatch(/emballée/);
    expect(PACKAGE_WEIGH_HINT).toMatch(/ne se change plus/);
  });

  it("isPackageSize n'accepte que les quatre ids, jamais le prototype", () => {
    for (const id of IDS) expect(isPackageSize(id)).toBe(true);
    for (const v of [
      "XL",
      "Petit",
      "",
      "__proto__",
      "toString",
      "constructor",
      42,
      null,
      undefined,
      {},
    ])
      expect(isPackageSize(v)).toBe(false);
  });

  it("packageSizeOf : taille absente ou invalide → « moyen »", () => {
    for (const v of [undefined, "XL", 42, "__proto__", null])
      expect(packageSizeOf(v)).toBe("moyen");
    for (const id of IDS) expect(packageSizeOf(id)).toBe(id);
  });

  it("weightLabel : grammes sous 1 kg, kilos au-delà", () => {
    expect(weightLabel(500)).toBe("500 g");
    expect(weightLabel(1000)).toBe("1 kg");
    expect(weightLabel(2000)).toBe("2 kg");
    expect(weightLabel(4000)).toBe("4 kg");
    expect(weightLabel(1500)).toBe("1,5 kg");
  });
});

describe("grille Mondial Relay — port selon la taille et le mode", () => {
  const IDS: PackageSizeId[] = ["petit", "moyen", "grand", "tres_grand"];
  const METHODS: ShipMethodId[] = ["mondial_relay", "mondial_relay_domicile"];

  it("les 8 prix de la grille publique du 15 juin 2026, au centime", () => {
    expect(shippingCents("mondial_relay", "petit")).toBe(415);
    expect(shippingCents("mondial_relay", "moyen")).toBe(599);
    expect(shippingCents("mondial_relay", "grand")).toBe(799);
    expect(shippingCents("mondial_relay", "tres_grand")).toBe(999);
    expect(shippingCents("mondial_relay_domicile", "petit")).toBe(749);
    expect(shippingCents("mondial_relay_domicile", "moyen")).toBe(949);
    expect(shippingCents("mondial_relay_domicile", "grand")).toBe(1099);
    expect(shippingCents("mondial_relay_domicile", "tres_grand")).toBe(1639);
    expect(SHIPPING_GRID_SOURCE).toEqual({
      url: "https://www.mondialrelay.fr/envoi-de-colis/tarifs-expeditions/",
      applicableFrom: "2026-06-15",
      checkedAt: "2026-09-28",
    });
  });

  it("des centimes entiers > 0, croissants avec la taille", () => {
    for (const m of METHODS) {
      const row = IDS.map((s) => shippingCents(m, s));
      for (const c of row) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThan(0);
      }
      for (let i = 1; i < row.length; i++)
        expect(row[i]).toBeGreaterThan(row[i - 1]);
    }
  });

  it("le domicile ne coûte jamais moins que le relais", () => {
    for (const s of IDS)
      expect(shippingCents("mondial_relay_domicile", s)).toBeGreaterThanOrEqual(
        shippingCents("mondial_relay", s),
      );
  });

  it("« envoi dès X € » = le prix en relais", () => {
    for (const s of IDS)
      expect(shippingFromCents(s)).toBe(shippingCents("mondial_relay", s));
    expect(shippingFromCents("petit")).toBe(415);
  });

  it("une taille invalide (annonce antérieure) est facturée « Moyen »", () => {
    expect(
      shippingCents("mondial_relay", "XL" as unknown as PackageSizeId),
    ).toBe(599);
  });

  it("isShipMethod : les deux modes Mondial Relay, rien d'autre", () => {
    for (const m of METHODS) expect(isShipMethod(m)).toBe(true);
    for (const v of [
      "chronopost",
      "point_relais",
      "__proto__",
      "constructor",
      "toString",
      "",
      42,
      undefined,
    ])
      expect(isShipMethod(v)).toBe(false);
  });

  it("chaque mode a sa ligne de grille et un transporteur connu", () => {
    for (const o of SHIP_OPTIONS) {
      expect(Object.hasOwn(SHIPPING_GRID_CENTS, o.id)).toBe(true);
      expect(Object.hasOwn(CARRIERS, o.carrierId)).toBe(true);
      expect(o.carrier).toBe(CARRIERS[o.carrierId].name);
    }
    expect(Object.keys(SHIPPING_GRID_CENTS).sort()).toEqual(
      SHIP_OPTIONS.map((o) => o.id).sort(),
    );
  });

  it("priceEUR (déprécié) reste égal au prix « Moyen » de la grille", () => {
    for (const o of SHIP_OPTIONS)
      expect(o.priceEUR * 100).toBe(SHIPPING_GRID_CENTS[o.id].moyen);
  });

  it("libellés des modes", () => {
    expect(shipMethodLabel("mondial_relay")).toBe(
      "Mondial Relay · Point Relais ou Locker",
    );
    expect(shipMethodLabel("mondial_relay_domicile")).toBe(
      "Mondial Relay · À domicile",
    );
    expect(shipOption("mondial_relay").eta).toBe("3–5 j ouvrés");
    expect(shipOption("mondial_relay_domicile").relay).toBe(false);
  });
});

describe("transporteur — indemnisation, réclamation, suivi", () => {
  it("Mondial Relay : plafond de 25 € avec sa source datée", () => {
    const mr = CARRIERS.mondial_relay;
    expect(mr.lossCompensationCents).toBe(2500);
    expect(mr.lossCompensationSource).toEqual({
      url: "https://www.mondialrelay.fr/envoi-de-colis/assurer-mon-colis/",
      checkedAt: "2026-09-28",
    });
  });

  it("toutes les URLs sont en https, le suivi sans paramètre", () => {
    for (const c of Object.values(CARRIERS)) {
      for (const url of [
        c.claimUrl,
        c.trackingUrl,
        c.lossCompensationSource.url,
      ])
        expect(url).toMatch(/^https:\/\//);
      expect(c.trackingUrl).not.toContain("?");
      expect(c.trackingHint.length).toBeGreaterThan(0);
    }
  });

  it("carrierOfOrder : par l'id, puis par le libellé historique", () => {
    expect(carrierOfOrder({ shippingMethodId: "mondial_relay" })).toBe(
      CARRIERS.mondial_relay,
    );
    expect(
      carrierOfOrder({
        shippingMethodId: "mondial_relay_domicile",
        shippingMethod: "Mondial Relay · À domicile",
      }),
    ).toBe(CARRIERS.mondial_relay);
    // commandes antérieures : libellé du transporteur seul
    expect(carrierOfOrder({ shippingMethod: "Mondial Relay" })).toBe(
      CARRIERS.mondial_relay,
    );
    expect(carrierOfOrder({ shippingMethod: "Chronopost" })).toBeNull();
    expect(carrierOfOrder({ shippingMethod: "Point Relais" })).toBeNull();
    expect(carrierOfOrder({ shippingMethod: "Livraison suivie" })).toBeNull();
    expect(carrierOfOrder({})).toBeNull();
    expect(
      carrierOfOrder({ shippingMethodId: "chronopost", shippingMethod: 42 }),
    ).toBeNull();
  });
});

describe("validateTracking — numéro de suivi obligatoire", () => {
  const error =
    "Indique le numéro de suivi de ton étiquette (6 à 40 lettres ou chiffres).";

  it("normalise : sans espaces, tirets ni points, en majuscules", () => {
    expect(validateTracking("6A 1234-567")).toEqual({
      ok: true,
      tracking: "6A1234567",
    });
    expect(validateTracking(" 12.345.678 ")).toEqual({
      ok: true,
      tracking: "12345678",
    });
    expect(validateTracking("ab12cd")).toEqual({
      ok: true,
      tracking: "AB12CD",
    });
  });

  it("6 à 40 caractères utiles", () => {
    expect(TRACKING_MIN).toBe(6);
    expect(TRACKING_MAX).toBe(40);
    expect(validateTracking("12345")).toEqual({ ok: false, error });
    expect(validateTracking("1-2 3.4-5")).toEqual({ ok: false, error });
    expect(validateTracking("1".repeat(40))).toMatchObject({ ok: true });
    expect(validateTracking("1".repeat(41))).toEqual({ ok: false, error });
  });

  it("refuse accents, symboles et valeurs qui ne sont pas du texte", () => {
    for (const v of ["ÉTIQUETTE12", "123456é", "1234/5678", "12345_678"])
      expect(validateTracking(v)).toEqual({ ok: false, error });
    // « ß » deviendrait « SS » en majuscules : refusé avant
    expect(validateTracking("straße1")).toEqual({ ok: false, error });
    for (const v of [undefined, null, 12345678, { tracking: "12345678" }])
      expect(validateTracking(v)).toEqual({ ok: false, error });
  });
});
