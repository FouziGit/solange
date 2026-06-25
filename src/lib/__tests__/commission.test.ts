import { describe, expect, it } from "vitest";
import { commission, commissionRate } from "@/lib/utils";

describe("commissionRate — degressive tiers", () => {
  it("charges 4% below 200 €", () => {
    expect(commissionRate(199)).toBe(0.04);
    expect(commissionRate(0)).toBe(0.04);
  });

  it("charges 3.5% in the [200, 500) band", () => {
    expect(commissionRate(200)).toBe(0.035);
    expect(commissionRate(499)).toBe(0.035);
  });

  it("charges 2.5% in the [500, 1000) band", () => {
    expect(commissionRate(500)).toBe(0.025);
    expect(commissionRate(999)).toBe(0.025);
  });

  it("charges 2% at 1000 € and above", () => {
    expect(commissionRate(1000)).toBe(0.02);
    expect(commissionRate(5000)).toBe(0.02);
  });
});

describe("commission — fee/net math", () => {
  it("computes fee and net for a 245 € listing (3.5%)", () => {
    const r = commission(245);
    expect(r.rate).toBe(0.035);
    // 245 * 0.035 = 8.575 -> rounds to 8.58
    expect(r.fee).toBe(8.58);
    expect(r.net).toBe(236.42);
  });

  it("net + fee reconstitutes the price", () => {
    const r = commission(420);
    expect(Math.round((r.net + r.fee) * 100) / 100).toBe(420);
  });

  it("rounds fee to two decimals", () => {
    const r = commission(95);
    // 95 * 0.04 = 3.8
    expect(r.fee).toBe(3.8);
    expect(r.net).toBe(91.2);
  });
});
