import { prisma } from "@/lib/prisma";

export type CancellationPolicyValues = {
  enabled: boolean;
  freeCancelDaysDefault: number;
  freeCancelDaysPeak: number;
};

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyValues = {
  enabled: true,
  freeCancelDaysDefault: 4,
  freeCancelDaysPeak: 2,
};

export type SeasonWindow = { startDate: string; endDate: string; adjustPct: number };

// A check-in date is "peak" when it falls inside a season with a positive
// adjustment (inclusive of both endpoints, matching the pricing engine). Dates
// are YYYY-MM-DD, so lexicographic comparison is chronological.
export function isPeakDate(seasons: SeasonWindow[], date: string): boolean {
  return seasons.some((s) => s.adjustPct > 0 && date >= s.startDate && date <= s.endDate);
}

// Whole days from `today` to `checkIn` (both YYYY-MM-DD, UTC-anchored). Negative
// once check-in has passed.
export function daysUntil(today: string, checkIn: string): number {
  const MS = 86_400_000;
  return Math.round((Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS);
}

export type RefundAssessment = {
  freeWindowDays: number;
  daysUntilCheckIn: number;
  withinFreeWindow: boolean;
  suggestedRefund: number; // advisory only — the owner may approve a partial
};

// Advisory: within the free window (or when the policy is disabled) the amount
// collected is refundable; outside it the policy suggests no refund and the
// owner decides case-by-case (a partial). Never more than what was collected.
export function assessRefund(opts: {
  policy: CancellationPolicyValues;
  isPeak: boolean;
  daysUntilCheckIn: number;
  collected: number;
}): RefundAssessment {
  const { policy, isPeak, daysUntilCheckIn, collected } = opts;
  const freeWindowDays = isPeak ? policy.freeCancelDaysPeak : policy.freeCancelDaysDefault;
  const withinFreeWindow = daysUntilCheckIn >= freeWindowDays;
  const suggestedRefund = !policy.enabled || withinFreeWindow ? Math.max(0, collected) : 0;
  return { freeWindowDays, daysUntilCheckIn, withinFreeWindow, suggestedRefund };
}

// Single-row policy, with sensible defaults if the owner hasn't saved one yet.
export async function getCancellationPolicy(): Promise<CancellationPolicyValues> {
  const row = await prisma.cancellationPolicy.findFirst();
  if (!row) return DEFAULT_CANCELLATION_POLICY;
  return {
    enabled: row.enabled,
    freeCancelDaysDefault: row.freeCancelDaysDefault,
    freeCancelDaysPeak: row.freeCancelDaysPeak,
  };
}
