import { prisma } from "@/lib/prisma";

// One rung of the refund ladder: cancel at least `minDaysBefore` days before
// check-in and you get `refundPct` of what you paid back. A ladder is a set of
// these; the applicable rung is the highest threshold still ≤ days-until-check-in.
export type CancellationTier = { minDaysBefore: number; refundPct: number };

export type CancellationPolicyValues = {
  enabled: boolean;
  tiers: CancellationTier[];
};

// Sensible starter ladder (Aiban's, and a reasonable generic): full refund far
// out, tapering to nothing inside a week. The owner edits this in Settings; it's
// also what a not-yet-configured policy falls back to.
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyValues = {
  enabled: true,
  tiers: [
    { minDaysBefore: 30, refundPct: 100 },
    { minDaysBefore: 20, refundPct: 75 },
    { minDaysBefore: 7, refundPct: 50 },
    { minDaysBefore: 0, refundPct: 0 },
  ],
};

// Whole days from `today` to `checkIn` (both YYYY-MM-DD, UTC-anchored). Negative
// once check-in has passed.
export function daysUntil(today: string, checkIn: string): number {
  const MS = 86_400_000;
  return Math.round((Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS);
}

// Normalise the JSON `tiers` column into a clean, sorted ladder. Defensive: a
// malformed row (hand-edited, or a shape from another version) degrades to the
// valid rungs it can find rather than throwing. Sorted highest-threshold-first,
// which is the order refundPctForDays scans.
export function parseTiers(value: unknown): CancellationTier[] {
  if (!Array.isArray(value)) return [];
  const tiers: CancellationTier[] = [];
  for (const t of value) {
    const d = (t as { minDaysBefore?: unknown })?.minDaysBefore;
    const p = (t as { refundPct?: unknown })?.refundPct;
    if (typeof d === "number" && Number.isFinite(d) && typeof p === "number" && Number.isFinite(p)) {
      tiers.push({ minDaysBefore: Math.max(0, Math.round(d)), refundPct: Math.min(100, Math.max(0, p)) });
    }
  }
  return tiers.sort((a, b) => b.minDaysBefore - a.minDaysBefore);
}

// The refund % for a cancellation this many days before check-in: the highest
// threshold that is still ≤ daysUntilCheckIn wins. Below the lowest rung (or past
// check-in) → 0.
export function refundPctForDays(tiers: CancellationTier[], daysUntilCheckIn: number): number {
  for (const t of [...tiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore)) {
    if (daysUntilCheckIn >= t.minDaysBefore) return t.refundPct;
  }
  return 0;
}

export type RefundAssessment = {
  daysUntilCheckIn: number;
  refundPct: number;
  suggestedRefund: number; // advisory — the owner may approve a different amount; never more than collected
};

// Advisory refund for a cancelled booking: the ladder's percentage of what was
// collected (whole rupees, matching the app's money convention). A disabled
// policy means the owner isn't enforcing tiers → full refund of what was paid.
export function assessRefund(opts: {
  policy: CancellationPolicyValues;
  daysUntilCheckIn: number;
  collected: number;
}): RefundAssessment {
  const { policy, daysUntilCheckIn, collected } = opts;
  const refundPct = policy.enabled ? refundPctForDays(policy.tiers, daysUntilCheckIn) : 100;
  const suggestedRefund = Math.round((Math.max(0, collected) * refundPct) / 100);
  return { daysUntilCheckIn, refundPct, suggestedRefund };
}

// Single-row policy. An unset (or empty-ladder) policy falls back to the default
// ladder rather than "no refund ever", so an existing install that never
// configured tiers still behaves sensibly.
export async function getCancellationPolicy(): Promise<CancellationPolicyValues> {
  const row = await prisma.cancellationPolicy.findFirst();
  if (!row) return DEFAULT_CANCELLATION_POLICY;
  const tiers = parseTiers(row.tiers);
  return {
    enabled: row.enabled,
    tiers: tiers.length ? tiers : DEFAULT_CANCELLATION_POLICY.tiers,
  };
}
