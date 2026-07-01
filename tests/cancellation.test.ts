import { describe, it, expect } from "vitest";
import {
  isPeakDate,
  daysUntil,
  assessRefund,
  DEFAULT_CANCELLATION_POLICY,
  type SeasonWindow,
} from "@/lib/cancellation";

const seasons: SeasonWindow[] = [
  { startDate: "2026-10-01", endDate: "2026-12-31", adjustPct: 20 }, // peak
  { startDate: "2026-01-01", endDate: "2026-04-30", adjustPct: -15 }, // lean (discount)
];

describe("isPeakDate", () => {
  it("is true inside a positively-adjusted season, inclusive of endpoints", () => {
    expect(isPeakDate(seasons, "2026-10-01")).toBe(true);
    expect(isPeakDate(seasons, "2026-11-15")).toBe(true);
    expect(isPeakDate(seasons, "2026-12-31")).toBe(true);
  });
  it("is false for discount seasons and outside any season", () => {
    expect(isPeakDate(seasons, "2026-02-10")).toBe(false); // lean/discount
    expect(isPeakDate(seasons, "2026-07-15")).toBe(false); // no season
  });
});

describe("daysUntil", () => {
  it("counts whole days and goes negative once past", () => {
    expect(daysUntil("2026-07-01", "2026-07-05")).toBe(4);
    expect(daysUntil("2026-07-01", "2026-07-01")).toBe(0);
    expect(daysUntil("2026-07-05", "2026-07-01")).toBe(-4);
  });
});

describe("assessRefund", () => {
  const policy = DEFAULT_CANCELLATION_POLICY; // 4 default / 2 peak

  it("refunds fully inside the default free window", () => {
    const a = assessRefund({ policy, isPeak: false, daysUntilCheckIn: 4, collected: 2000 });
    expect(a.withinFreeWindow).toBe(true);
    expect(a.suggestedRefund).toBe(2000);
  });

  it("suggests no refund past the default window", () => {
    const a = assessRefund({ policy, isPeak: false, daysUntilCheckIn: 3, collected: 2000 });
    expect(a.withinFreeWindow).toBe(false);
    expect(a.suggestedRefund).toBe(0);
  });

  it("uses the shorter peak window", () => {
    const a = assessRefund({ policy, isPeak: true, daysUntilCheckIn: 2, collected: 5000 });
    expect(a.freeWindowDays).toBe(2);
    expect(a.withinFreeWindow).toBe(true);
    expect(a.suggestedRefund).toBe(5000);
  });

  it("refunds the collected amount when the policy is disabled", () => {
    const a = assessRefund({ policy: { ...policy, enabled: false }, isPeak: false, daysUntilCheckIn: 0, collected: 1200 });
    expect(a.suggestedRefund).toBe(1200);
  });
});
