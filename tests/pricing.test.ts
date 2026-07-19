import { describe, it, expect } from "vitest";
import { computeNightRate, weekdayOf, DEFAULT_POLICY, type Policy, type RoomTypeRates } from "@/lib/pricing";

// Pure-function tests for the rate calculator — no database involved.
// Money is integer paise (GAP-9): ₹1,000 base = 100_000 paise. Suggested rates stay
// whole-rupee, so every expected value is an exact multiple of 100.

const rates: RoomTypeRates = { baseRate: 100_000, rateFloor: 50_000, rateCeiling: 500_000 };
const base = (over: Partial<Policy> = {}): Policy => ({ ...DEFAULT_POLICY, ...over });

// June 2026: 5th = Fri, 6th = Sat, 7th = Sun, 3rd = Wed (anchored to 2026-06-02 = Tue).
const SAT = "2026-06-06";
const WED = "2026-06-03";

function rate(opts: Partial<Parameters<typeof computeNightRate>[0]> & { date: string }) {
  return computeNightRate({
    rates,
    policy: base(),
    seasons: [],
    leadDays: 10,
    occupancyPct: 0,
    override: null,
    ...opts,
  });
}

describe("weekdayOf", () => {
  it("is UTC-stable", () => {
    expect(weekdayOf(SAT)).toBe(6);
    expect(weekdayOf(WED)).toBe(3);
  });
});

describe("computeNightRate", () => {
  it("returns base rate when nothing applies", () => {
    const r = rate({ date: WED });
    expect(r.rate).toBe(100_000);
    expect(r.applied).toEqual([]);
  });

  it("applies a weekend uplift only on weekend days", () => {
    const policy = base({ weekendAdjustPct: 20 });
    expect(computeNightRate({ date: SAT, rates, policy, seasons: [], leadDays: 10, occupancyPct: 0 }).rate).toBe(120_000);
    expect(computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 10, occupancyPct: 0 }).rate).toBe(100_000);
  });

  it("applies a matching season range (inclusive)", () => {
    const seasons = [{ name: "Diwali", startDate: "2026-06-05", endDate: "2026-06-07", adjustPct: 50 }];
    expect(rate({ date: SAT, seasons }).rate).toBe(150_000);
    expect(rate({ date: WED, seasons }).rate).toBe(100_000); // outside the range
  });

  it("gives an early-bird discount past the lead threshold", () => {
    const policy = base({ leadEarlyDays: 30, leadEarlyAdjustPct: -10 });
    expect(computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 40, occupancyPct: 0 }).rate).toBe(90_000);
    expect(computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 5, occupancyPct: 0 }).rate).toBe(100_000);
  });

  it("last-minute uplift takes precedence over early-bird", () => {
    const policy = base({ leadEarlyDays: 30, leadEarlyAdjustPct: -10, leadLateDays: 3, leadLateAdjustPct: 25 });
    const r = computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 1, occupancyPct: 0 });
    expect(r.rate).toBe(125_000);
    expect(r.applied.some((a) => a.startsWith("Last-minute"))).toBe(true);
  });

  it("applies an occupancy uplift at/above the threshold", () => {
    const policy = base({ occupancyThresholdPct: 80, occupancyAdjustPct: 15 });
    expect(computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 10, occupancyPct: 90 }).rate).toBe(115_000);
    expect(computeNightRate({ date: WED, rates, policy, seasons: [], leadDays: 10, occupancyPct: 50 }).rate).toBe(100_000);
  });

  it("clamps to the ceiling and flags it", () => {
    const tight: RoomTypeRates = { baseRate: 100_000, rateFloor: 50_000, rateCeiling: 110_000 };
    const r = computeNightRate({ date: SAT, rates: tight, policy: base({ weekendAdjustPct: 50 }), seasons: [], leadDays: 10, occupancyPct: 0 });
    expect(r.rate).toBe(110_000);
    expect(r.applied).toContain("Clamped to floor/ceiling");
  });

  it("clamps up to the floor", () => {
    const tight: RoomTypeRates = { baseRate: 100_000, rateFloor: 90_000, rateCeiling: 500_000 };
    const seasons = [{ name: "Off-season", startDate: WED, endDate: WED, adjustPct: -50 }];
    const r = computeNightRate({ date: WED, rates: tight, policy: base(), seasons, leadDays: 10, occupancyPct: 0 });
    expect(r.rate).toBe(90_000);
  });

  it("an override wins over all rules and the clamp", () => {
    const tight: RoomTypeRates = { baseRate: 100_000, rateFloor: 50_000, rateCeiling: 60_000 };
    const r = computeNightRate({ date: SAT, rates: tight, policy: base({ weekendAdjustPct: 50 }), seasons: [], leadDays: 10, occupancyPct: 0, override: 77_700 });
    expect(r.rate).toBe(77_700);
    expect(r.applied).toEqual(["Override"]);
  });

  it("compounds multiple adjustments", () => {
    const seasons = [{ name: "Peak", startDate: SAT, endDate: SAT, adjustPct: 10 }];
    const r = computeNightRate({ date: SAT, rates, policy: base({ weekendAdjustPct: 10 }), seasons, leadDays: 10, occupancyPct: 0 });
    expect(r.rate).toBe(121_000); // 100_000 * 1.1 * 1.1
  });
});
