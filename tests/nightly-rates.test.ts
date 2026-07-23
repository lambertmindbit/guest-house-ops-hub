import { describe, expect, it } from "vitest";
import { parseNightlyRates, nightlyTotal } from "@/lib/nightly-rates";

describe("parseNightlyRates", () => {
  it("parses a valid snapshot and sums to the total", () => {
    const rows = parseNightlyRates([
      { date: "2026-01-10", ratePaise: 250000, applied: ["Weekend +20%"] },
      { date: "2026-01-11", ratePaise: 200000, applied: [] },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: "2026-01-10", ratePaise: 250000, applied: ["Weekend +20%"] });
    expect(nightlyTotal(rows)).toBe(450000);
  });

  it("is tolerant: null / non-array / garbled rows yield [] or are dropped", () => {
    expect(parseNightlyRates(null)).toEqual([]);
    expect(parseNightlyRates("nope")).toEqual([]);
    expect(parseNightlyRates([{ ratePaise: 100 }, 5, null, { date: "2026-02-01", ratePaise: 100000 }]))
      .toEqual([{ date: "2026-02-01", ratePaise: 100000, applied: [] }]);
  });
});
