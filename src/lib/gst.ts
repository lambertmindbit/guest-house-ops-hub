import { pctOfPaise, roundToRupee, type Money } from "@/lib/money";

// GST for hotel accommodation (GAP-11/US-205). Pure — no DB, no I/O — so the tax
// arithmetic is fully testable and an invoice can be recomputed identically.
//
// Three decisions this encodes, all confirmed with the owner:
//
// 1. SLABS ARE CONFIGURATION, NOT CODE. Tax law changes (the 12% band became 5% on
//    22 Sep 2025). The defaults below are the current rates, but each property
//    stores its own table, so a rate change is a Settings edit — never a migration.
//    Every invoice snapshots the rate it applied, so history stays auditable.
//
// 2. TARIFF IS GST-INCLUSIVE. `grossAmount` is what the guest actually pays, so tax
//    is EXTRACTED from it (taxable = gross × 100/(100+rate)), not added on top.
//    Adding on top would push every invoice total above the booking's recorded
//    gross and break `balance = gross − collected`, which the whole app rests on.
//
// 3. ALWAYS INTRA-STATE (CGST+SGST, never IGST). For accommodation the place of
//    supply is the location of the property itself, so supply is intra-state even
//    for an out-of-state guest. State is taken from the GSTIN's first two digits.

export type GstSlab = {
  /** Inclusive upper bound of the per-night tariff, in paise. null = no upper bound. */
  uptoPaise: number | null;
  /** Whole-percent GST rate for this band. */
  ratePct: number;
};

// Current Indian hotel-accommodation slabs, by per-night tariff (value of supply):
// ≤ ₹1,000 exempt · ₹1,001–₹7,500 → 5% · above ₹7,500 → 18%.
export const DEFAULT_GST_SLABS: GstSlab[] = [
  { uptoPaise: 100_000, ratePct: 0 },
  { uptoPaise: 750_000, ratePct: 5 },
  { uptoPaise: null, ratePct: 18 },
];

// The slab is chosen by the tariff ACTUALLY charged per night, so a discount that
// drops a room below a threshold genuinely changes the rate.
export function rateForNightlyTariff(perNightPaise: number, slabs: GstSlab[] = DEFAULT_GST_SLABS): number {
  const ordered = [...slabs].sort((a, b) => (a.uptoPaise ?? Infinity) - (b.uptoPaise ?? Infinity));
  for (const s of ordered) {
    if (s.uptoPaise === null || perNightPaise <= s.uptoPaise) return s.ratePct;
  }
  return ordered[ordered.length - 1]?.ratePct ?? 0;
}

// A GSTIN's first two characters are the state code; identical codes on both sides
// of the supply means intra-state (CGST+SGST). Accommodation is always supplied
// where the property stands, so this is really just a well-formedness check.
export function stateCodeOf(gstin: string | null | undefined): string | null {
  const g = gstin?.trim();
  return g && /^\d{2}/.test(g) ? g.slice(0, 2) : null;
}

export type TaxBreakdown = {
  ratePct: number;
  /** Pre-tax value of supply. */
  taxablePaise: Money;
  cgstPaise: Money;
  sgstPaise: Money;
  totalTaxPaise: Money;
  /** taxable + tax, before the whole-rupee round-off. */
  grossPaise: Money;
};

// Extract the tax already contained in a GST-inclusive amount. CGST and SGST are
// each half the total; SGST takes any odd paise so the two halves always sum back
// to the total exactly (never off by one paisa).
export function extractInclusiveTax(grossPaise: number, ratePct: number): TaxBreakdown {
  const taxable = Math.round((grossPaise * 100) / (100 + ratePct)) as Money;
  const totalTax = (grossPaise - taxable) as Money;
  const cgst = Math.floor(totalTax / 2) as Money;
  const sgst = (totalTax - cgst) as Money;
  return { ratePct, taxablePaise: taxable, cgstPaise: cgst, sgstPaise: sgst, totalTaxPaise: totalTax, grossPaise: grossPaise as Money };
}

export type InvoiceComputation = {
  /** True when the property is GST-registered — drives whether tax lines appear at all. */
  taxable: boolean;
  nights: number;
  perNightPaise: Money;
  breakdown: TaxBreakdown | null;
  /** Grand total the guest pays, rounded to the whole rupee. */
  totalPaise: Money;
  roundOffPaise: Money;
};

// The full invoice money computation for one stay. With no GSTIN the property isn't
// registered, so there are no tax lines at all and the total is simply the gross —
// exactly what the "mixed pilots" answer requires, driven purely by config.
export function computeInvoice(opts: {
  grossPaise: number;
  nights: number;
  gstin: string | null | undefined;
  slabs?: GstSlab[];
}): InvoiceComputation {
  const { grossPaise, nights, gstin } = opts;
  const safeNights = Math.max(1, nights);
  const perNight = Math.round(grossPaise / safeNights) as Money;
  const registered = !!stateCodeOf(gstin);

  if (!registered) {
    const { rounded, roundOff } = roundToRupee(grossPaise);
    return { taxable: false, nights: safeNights, perNightPaise: perNight, breakdown: null, totalPaise: rounded, roundOffPaise: roundOff };
  }

  const ratePct = rateForNightlyTariff(perNight, opts.slabs ?? DEFAULT_GST_SLABS);
  const breakdown = extractInclusiveTax(grossPaise, ratePct);
  const { rounded, roundOff } = roundToRupee(grossPaise);
  return { taxable: true, nights: safeNights, perNightPaise: perNight, breakdown, totalPaise: rounded, roundOffPaise: roundOff };
}

// ─── Invoice numbering ──────────────────────────────────────────────────────

// Indian financial year runs 1 Apr – 31 Mar, written "2026-27".
export function financialYearOf(date: Date): string {
  const y = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? y : y - 1; // month 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// "<PREFIX>/2026-27/0001" — a consecutive series, unique per property per FY, and
// within the 16-character statutory limit for a normal prefix.
export function formatInvoiceNumber(prefix: string, financialYear: string, seq: number): string {
  const p = prefix.trim() || "INV";
  return `${p}/${financialYear}/${String(seq).padStart(4, "0")}`;
}

export { pctOfPaise };
