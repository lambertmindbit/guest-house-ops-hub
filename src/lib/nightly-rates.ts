// Per-night rate breakdown (GAP-22). The pricing quote already computes a rate for
// each night; we snapshot it on the reservation so invoices and partial-stay math
// have the real nightly rates, not a lump-sum gross divided evenly. Pure + tolerant:
// a legacy/null/garbled value yields [] rather than throwing, so it can never break
// a page.

export type NightlyRate = { date: string; ratePaise: number; applied: string[] };

export function parseNightlyRates(raw: unknown): NightlyRate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => (typeof n === "object" && n !== null ? (n as Record<string, unknown>) : null))
    .filter((n): n is Record<string, unknown> => n !== null)
    .map((n) => ({
      date: typeof n.date === "string" ? n.date : "",
      ratePaise: typeof n.ratePaise === "number" ? n.ratePaise : 0,
      applied: Array.isArray(n.applied) ? n.applied.filter((a): a is string => typeof a === "string") : [],
    }))
    .filter((n) => n.date !== "");
}

export function nightlyTotal(rates: NightlyRate[]): number {
  return rates.reduce((s, n) => s + n.ratePaise, 0);
}
