import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_GST_SLABS, rateForNightlyTariff, stateCodeOf, extractInclusiveTax,
  computeInvoice, financialYearOf, formatInvoiceNumber,
} from "@/lib/gst";

// GAP-11/US-205: statutory GST arithmetic. All money is paise.

describe("rateForNightlyTariff (slab by actual per-night tariff)", () => {
  it("applies the current hotel slabs at their boundaries", () => {
    expect(rateForNightlyTariff(80_000)).toBe(0); // ₹800
    expect(rateForNightlyTariff(100_000)).toBe(0); // ₹1,000 — inclusive upper bound
    expect(rateForNightlyTariff(100_100)).toBe(5); // ₹1,001
    expect(rateForNightlyTariff(750_000)).toBe(5); // ₹7,500 — inclusive
    expect(rateForNightlyTariff(750_100)).toBe(18); // ₹7,501
  });

  it("honours a property's own slab table (rates are config, not code)", () => {
    const custom = [{ uptoPaise: 500_000, ratePct: 12 }, { uptoPaise: null, ratePct: 28 }];
    expect(rateForNightlyTariff(400_000, custom)).toBe(12);
    expect(rateForNightlyTariff(600_000, custom)).toBe(28);
  });
});

describe("stateCodeOf", () => {
  it("reads the state code from a GSTIN, and rejects junk", () => {
    expect(stateCodeOf("27AAPFU0939F1ZV")).toBe("27");
    expect(stateCodeOf(null)).toBeNull();
    expect(stateCodeOf("")).toBeNull();
    expect(stateCodeOf("not-a-gstin")).toBeNull();
  });
});

describe("extractInclusiveTax (tariff is GST-inclusive)", () => {
  it("extracts tax from the guest-facing price rather than adding it on top", () => {
    // ₹2,100 inclusive at 5% → ₹2,000 taxable + ₹100 tax (₹50 CGST + ₹50 SGST).
    const b = extractInclusiveTax(210_000, 5);
    expect(b.taxablePaise).toBe(200_000);
    expect(b.totalTaxPaise).toBe(10_000);
    expect(b.cgstPaise).toBe(5_000);
    expect(b.sgstPaise).toBe(5_000);
  });

  it("0% leaves the whole amount taxable with no tax", () => {
    const b = extractInclusiveTax(90_000, 0);
    expect(b.taxablePaise).toBe(90_000);
    expect(b.totalTaxPaise).toBe(0);
  });

  it("taxable + tax always reconciles back to the gross, and CGST+SGST to the tax", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100_000_000 }), fc.constantFrom(0, 5, 12, 18, 28), (gross, rate) => {
      const b = extractInclusiveTax(gross, rate);
      expect(b.taxablePaise + b.totalTaxPaise).toBe(gross); // no leaked paisa
      expect(b.cgstPaise + b.sgstPaise).toBe(b.totalTaxPaise); // halves always sum
      expect(Math.abs(b.sgstPaise - b.cgstPaise)).toBeLessThanOrEqual(1); // odd paisa to SGST
    }));
  });
});

describe("computeInvoice", () => {
  const GSTIN = "27AAPFU0939F1ZV";

  it("a property with NO GSTIN gets no tax lines at all (mixed-pilot config)", () => {
    const inv = computeInvoice({ grossPaise: 420_000, nights: 2, gstin: null });
    expect(inv.taxable).toBe(false);
    expect(inv.breakdown).toBeNull();
    expect(inv.totalPaise).toBe(420_000);
  });

  it("a registered property gets slab-selected tax lines", () => {
    // ₹4,200 over 2 nights = ₹2,100/night → 5% band.
    const inv = computeInvoice({ grossPaise: 420_000, nights: 2, gstin: GSTIN });
    expect(inv.taxable).toBe(true);
    expect(inv.perNightPaise).toBe(210_000);
    expect(inv.breakdown!.ratePct).toBe(5);
    expect(inv.breakdown!.taxablePaise + inv.breakdown!.totalTaxPaise).toBe(420_000);
  });

  it("the slab follows the per-night tariff, so a long stay is not pushed up a band", () => {
    // ₹16,000 over 4 nights = ₹4,000/night → 5%, NOT 18% on the ₹16,000 total.
    expect(computeInvoice({ grossPaise: 1_600_000, nights: 4, gstin: GSTIN }).breakdown!.ratePct).toBe(5);
    // ₹16,000 for a single night → ₹16,000/night → 18%.
    expect(computeInvoice({ grossPaise: 1_600_000, nights: 1, gstin: GSTIN }).breakdown!.ratePct).toBe(18);
  });

  it("the grand total is whole rupees and round-off reconciles", () => {
    const inv = computeInvoice({ grossPaise: 210_050, nights: 1, gstin: GSTIN });
    expect(inv.totalPaise % 100).toBe(0);
    expect(inv.totalPaise).toBe(210_050 + inv.roundOffPaise);
  });
});

describe("invoice numbering", () => {
  it("financial year runs Apr–Mar", () => {
    expect(financialYearOf(new Date("2026-04-01T00:00:00Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2027-03-31T00:00:00Z"))).toBe("2026-27");
    expect(financialYearOf(new Date("2026-01-15T00:00:00Z"))).toBe("2025-26");
    expect(financialYearOf(new Date("2026-12-31T00:00:00Z"))).toBe("2026-27");
  });

  it("formats a consecutive, statutory-length series", () => {
    expect(formatInvoiceNumber("GH", "2026-27", 1)).toBe("GH/2026-27/0001");
    expect(formatInvoiceNumber("GH", "2026-27", 1234)).toBe("GH/2026-27/1234");
    expect(formatInvoiceNumber("", "2026-27", 7)).toBe("INV/2026-27/0007");
    expect(formatInvoiceNumber("GH", "2026-27", 1).length).toBeLessThanOrEqual(16);
  });
});
