import { describe, it, expect } from "vitest";
import {
  daysUntil,
  refundPctForDays,
  assessRefund,
  parseTiers,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationTier,
} from "@/lib/cancellation";

// Aiban's ladder (confirmed): 100% at 30+, 75% at 20–29, 50% at 7–19, 0% inside a
// week (2–6 and the last 48h both nothing).
const ladder: CancellationTier[] = [
  { minDaysBefore: 30, refundPct: 100 },
  { minDaysBefore: 20, refundPct: 75 },
  { minDaysBefore: 7, refundPct: 50 },
  { minDaysBefore: 0, refundPct: 0 },
];

describe("daysUntil", () => {
  it("counts whole days and goes negative once past", () => {
    expect(daysUntil("2026-07-01", "2026-07-05")).toBe(4);
    expect(daysUntil("2026-07-01", "2026-07-01")).toBe(0);
    expect(daysUntil("2026-07-05", "2026-07-01")).toBe(-4);
  });
});

describe("refundPctForDays", () => {
  it("picks the highest band still at or below the days remaining", () => {
    expect(refundPctForDays(ladder, 35)).toBe(100); // 30+
    expect(refundPctForDays(ladder, 30)).toBe(100); // exactly the threshold
    expect(refundPctForDays(ladder, 25)).toBe(75); // 20–29
    expect(refundPctForDays(ladder, 12)).toBe(50); // 7–19
    expect(refundPctForDays(ladder, 3)).toBe(0); // inside a week
  });
  it("is 0 on the last two days and after check-in (Aiban's rule)", () => {
    expect(refundPctForDays(ladder, 1)).toBe(0);
    expect(refundPctForDays(ladder, 0)).toBe(0);
    expect(refundPctForDays(ladder, -2)).toBe(0);
  });
  it("order of the tiers doesn't matter", () => {
    const shuffled = [ladder[2], ladder[0], ladder[3], ladder[1]];
    expect(refundPctForDays(shuffled, 25)).toBe(75);
  });
});

describe("assessRefund", () => {
  const policy = { enabled: true, tiers: ladder };

  it("refunds the ladder's share of what was collected, whole rupees; values are paise", () => {
    expect(assessRefund({ policy, daysUntilCheckIn: 25, collected: 400_000 }).suggestedRefund).toBe(300_000); // 75% of ₹4,000
    expect(assessRefund({ policy, daysUntilCheckIn: 12, collected: 333_300 }).suggestedRefund).toBe(166_700); // 50% of ₹3,333 → ₹1,666.5 → ₹1,667
    expect(assessRefund({ policy, daysUntilCheckIn: 3, collected: 400_000 }).suggestedRefund).toBe(0); // inside a week
  });
  it("reports the applied percentage", () => {
    expect(assessRefund({ policy, daysUntilCheckIn: 25, collected: 400_000 }).refundPct).toBe(75);
  });
  it("a disabled policy refunds everything collected (owner isn't enforcing tiers)", () => {
    expect(assessRefund({ policy: { ...policy, enabled: false }, daysUntilCheckIn: 0, collected: 120_000 }).suggestedRefund).toBe(120_000);
  });
  it("never refunds more than was collected", () => {
    expect(assessRefund({ policy, daysUntilCheckIn: 40, collected: 0 }).suggestedRefund).toBe(0);
  });
});

describe("parseTiers", () => {
  it("normalises and sorts a JSON ladder highest-threshold first", () => {
    const out = parseTiers([{ minDaysBefore: 7, refundPct: 50 }, { minDaysBefore: 30, refundPct: 100 }]);
    expect(out.map((t) => t.minDaysBefore)).toEqual([30, 7]);
  });
  it("drops malformed rungs and clamps out-of-range values", () => {
    const out = parseTiers([{ minDaysBefore: 10, refundPct: 150 }, { foo: 1 }, "nope", { minDaysBefore: -5, refundPct: 40 }]);
    expect(out).toEqual([
      { minDaysBefore: 10, refundPct: 100 }, // 150 clamped to 100
      { minDaysBefore: 0, refundPct: 40 }, // -5 clamped to 0
    ]);
  });
  it("returns an empty ladder for non-array input", () => {
    expect(parseTiers(null)).toEqual([]);
    expect(parseTiers("[]")).toEqual([]);
  });
  it("the default ladder round-trips through parse unchanged", () => {
    expect(parseTiers(DEFAULT_CANCELLATION_POLICY.tiers)).toEqual(DEFAULT_CANCELLATION_POLICY.tiers);
  });
});
