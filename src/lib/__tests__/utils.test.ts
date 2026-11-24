import { describe, expect, it } from "vitest";
import { euro } from "../utils";

/* Toutes les espaces attendues sont insécables (U+00A0) : un prix ne se
   coupe jamais en deux lignes. */
describe("euro", () => {
  it("écrit un entier sans décimales", () => {
    expect(euro(290)).toBe("290\u00a0€");
    expect(euro(0)).toBe("0\u00a0€");
  });

  it("écrit deux décimales après une virgule", () => {
    expect(euro(5.99)).toBe("5,99\u00a0€");
  });

  it("groupe les milliers", () => {
    expect(euro(12642)).toBe("12\u00a0642\u00a0€");
    expect(euro(1234.5)).toBe("1\u00a0234,50\u00a0€");
  });
});
