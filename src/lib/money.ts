// Integer-paise money (GAP-9/US-401). 1 rupee = 100 paise. Money is stored as a
// Postgres BIGINT and handled throughout the app as a `Money` — an integer number
// of paise. JS numbers are exact integers up to 2^53 (≈ ₹9×10¹³ in paise), far
// beyond any value in this domain, so paise arithmetic in `number` is exact.
//
// The ONLY conversions between rupees and paise happen at the edges: parsing a
// user's rupee input (rupeesToPaise) and rendering for display (formatPaise). In
// between — DB, API, calculations — everything is paise. Percentages (commission,
// pricing adjustments) are NOT money and stay as-is; pctOfPaise is the single
// rounding site where a percentage is applied to a money amount.

// Branded so a raw rupee number can't be passed where paise are expected without
// going through a conversion. Erases to `number` at runtime.
export type Money = number & { readonly __brand: "paise" };

export const PAISE_PER_RUPEE = 100;

// Rupees (whole or fractional) → integer paise, half-up. Use at input parsing.
export function rupeesToPaise(rupees: number): Money {
  return Math.round(rupees * PAISE_PER_RUPEE) as Money;
}

// Integer paise → rupees (may be fractional). Use for rupee-denominated outputs
// (CSV cells, invoice line values) that must stay byte-identical to the old format.
// Accepts a plain number since paise read from the DB (Number(bigint)) are numbers.
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

// Read a money value from Prisma (BIGINT → bigint) or the wire (number) into Money.
// Paise values are tiny relative to 2^53, so the bigint→number narrowing is exact.
export function moneyFromDb(v: bigint | number | null | undefined): Money | null {
  return v === null || v === undefined ? null : (Number(v) as Money);
}

// Money → the bigint a Prisma BIGINT column expects, for writes.
export function moneyToDb(paise: number): bigint {
  return BigInt(Math.round(paise));
}

// Coerce an already-paise value (from the wire, possibly not yet branded) to Money.
export function asMoney(paise: number): Money {
  return Math.round(paise) as Money;
}

// A percentage of a money amount, rounded to the WHOLE RUPEE — the app's existing
// money convention for commission and the refund ladder. Kept byte-identical to
// the old `Math.round(rupees * pct / 100)` so no visible finance value changes in
// the paise migration. (Paise-precise %-rounding, for statutory GST tax lines,
// arrives with GAP-11 invoicing — not here.)
export function pctOfMoneyWholeRupee(paise: number, pct: number): Money {
  return rupeesToPaise(Math.round((paiseToRupees(paise) * pct) / 100));
}

export function sumPaise(values: number[]): Money {
  return values.reduce((a, b) => a + b, 0) as Money;
}

// Paise → "₹1,234". Rounds to whole rupees, byte-identical to the app's prior
// `displayINR` (maximumFractionDigits: 0 on rupee floats), so the migration changes
// no visible value — including computed metrics like ADR/RevPAR that don't land on
// a whole rupee. Paise-precise display (₹1,234.50) for statutory invoices comes with
// GAP-11, not here.
export function formatPaise(paise: number | bigint | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(paise) / PAISE_PER_RUPEE);
}
