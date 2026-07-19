import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  rupeesToPaise, paiseToRupees, moneyFromDb, moneyToDb, asMoney,
  pctOfMoneyWholeRupee, sumPaise, formatPaise, type Money,
} from "@/lib/money";

// GAP-9/US-401: money is integer paise behind a typed utility. Property-based
// tests pin the arithmetic invariants the whole finance layer now depends on.

// Realistic domain range: 0 … ₹100 crore, in whole paise.
const paise = fc.integer({ min: 0, max: 1_000_000_000_00 }).map(asMoney);
const pct = fc.integer({ min: 0, max: 100 });

describe("rupees ↔ paise", () => {
  it("whole rupees round-trip exactly", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100_000_000 }), (rupees) => {
      expect(paiseToRupees(rupeesToPaise(rupees))).toBe(rupees);
    }));
  });

  it("rupeesToPaise is half-up to the paise", () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(19.999)).toBe(2000); // 1999.9 → 2000
    expect(rupeesToPaise(0.005)).toBe(1); // .5 paise rounds up
  });
});

describe("moneyFromDb / moneyToDb", () => {
  it("bigint ↔ Money round-trips and nulls pass through", () => {
    fc.assert(fc.property(paise, (p) => {
      expect(moneyFromDb(moneyToDb(p))).toBe(p);
    }));
    expect(moneyFromDb(null)).toBeNull();
    expect(moneyFromDb(undefined)).toBeNull();
    expect(moneyToDb(asMoney(200000))).toBe(200000n);
  });
});

describe("pctOfMoneyWholeRupee (commission / refund convention)", () => {
  // Base is whole rupees (the money we actually hold), so the percentage properties
  // hold and stay whole-rupee.
  const wholeRupeePaise = fc.integer({ min: 0, max: 100_000_000 }).map((r) => asMoney(r * 100));

  it("0% is zero, 100% is identity (on whole-rupee amounts)", () => {
    fc.assert(fc.property(wholeRupeePaise, (p) => {
      expect(pctOfMoneyWholeRupee(p, 0)).toBe(0);
      expect(pctOfMoneyWholeRupee(p, 100)).toBe(p);
    }));
  });

  it("a valid percentage never exceeds the base and is non-negative", () => {
    fc.assert(fc.property(wholeRupeePaise, pct, (p, q) => {
      const part = pctOfMoneyWholeRupee(p, q);
      expect(part).toBeGreaterThanOrEqual(0);
      expect(part).toBeLessThanOrEqual(p);
    }));
  });

  it("result is always a whole number of rupees", () => {
    fc.assert(fc.property(wholeRupeePaise, pct, (p, q) => {
      expect(pctOfMoneyWholeRupee(p, q) % 100).toBe(0);
    }));
  });

  it("matches the prior whole-rupee behaviour byte-for-byte", () => {
    // Old: Math.round(999 * 15 / 100) = 150 rupees = 15000 paise (NOT paise-precise 14985).
    expect(pctOfMoneyWholeRupee(asMoney(99900), 15)).toBe(15000);
    // Fractional pct (12.5% of ₹2000 = ₹250).
    expect(pctOfMoneyWholeRupee(asMoney(200000), 12.5)).toBe(25000);
  });
});

describe("sumPaise", () => {
  it("equals a plain integer reduction (exact, no float drift)", () => {
    fc.assert(fc.property(fc.array(paise, { maxLength: 50 }), (xs) => {
      expect(sumPaise(xs)).toBe(xs.reduce((a, b) => a + b, 0));
    }));
  });
});

describe("formatPaise", () => {
  it("renders whole rupees, byte-identical to the old displayINR", () => {
    expect(formatPaise(asMoney(200000))).toBe("₹2,000");
    expect(formatPaise(asMoney(0))).toBe("₹0");
    expect(formatPaise(1_00_00_000_00n as unknown as Money)).toBe("₹1,00,00,000");
  });

  it("rounds sub-rupee/computed amounts to the whole rupee (unchanged display)", () => {
    // ADR-style fractional paise: 66666.67 paise = ₹666.67 → old & new both show ₹667.
    expect(formatPaise(asMoney(66667))).toBe("₹667");
    expect(formatPaise(200050 as unknown as Money)).toBe("₹2,001"); // 2000.50 → 2001
  });

  it("null/undefined render as an em dash", () => {
    expect(formatPaise(null)).toBe("—");
    expect(formatPaise(undefined)).toBe("—");
  });
});
