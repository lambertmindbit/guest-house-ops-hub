import { prisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";
import { addDays, parseDateOnly, todayDateOnly, formatDateOnly } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Advisory pricing. The engine SUGGESTS a nightly rate; it never pushes to any
// OTA and never rewrites a saved booking. Starting from a room type's base rate
// it compounds the enabled adjustments, then clamps to [floor, ceiling]. A
// manual per-date override wins over everything (including the clamp).
// ---------------------------------------------------------------------------

export type RoomTypeRates = { baseRate: number; rateFloor: number; rateCeiling: number };

export type Policy = {
  enabled: boolean;
  weekendDays: number[]; // 0=Sun … 6=Sat
  weekendAdjustPct: number;
  leadEarlyDays: number | null;
  leadEarlyAdjustPct: number | null;
  leadLateDays: number | null;
  leadLateAdjustPct: number | null;
  occupancyThresholdPct: number | null;
  occupancyAdjustPct: number | null;
};

export type SeasonRule = { name: string; startDate: string; endDate: string; adjustPct: number };
export type NightRate = { date: string; rate: number; applied: string[] };
export type Quote = { roomTypeId: string; currency: string; nights: NightRate[]; total: number };

export const DEFAULT_POLICY: Policy = {
  enabled: true,
  weekendDays: [5, 6],
  weekendAdjustPct: 0,
  leadEarlyDays: null,
  leadEarlyAdjustPct: null,
  leadLateDays: null,
  leadLateAdjustPct: null,
  occupancyThresholdPct: null,
  occupancyAdjustPct: null,
};

const round = (n: number) => Math.round(n);
const fmtPct = (p: number) => `${p > 0 ? "+" : ""}${p}%`;

// Weekday for a YYYY-MM-DD, anchored to UTC midnight (consistent with how stays
// are stored) so it never drifts with the server's local timezone.
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

// Pure: given one night's inputs, return the suggested rate + which rules applied.
// `leadDays` is the same for every night of a stay (it's measured from check-in).
export function computeNightRate(opts: {
  date: string;
  rates: RoomTypeRates;
  policy: Policy;
  seasons: SeasonRule[];
  leadDays: number;
  occupancyPct: number;
  override?: number | null;
}): NightRate {
  const { date, rates, policy, seasons, leadDays, occupancyPct, override } = opts;

  if (override != null) return { date, rate: round(override), applied: ["Override"] };

  let rate = rates.baseRate;
  const applied: string[] = [];

  if (policy.enabled) {
    if (policy.weekendDays.includes(weekdayOf(date)) && policy.weekendAdjustPct !== 0) {
      rate *= 1 + policy.weekendAdjustPct / 100;
      applied.push(`Weekend ${fmtPct(policy.weekendAdjustPct)}`);
    }
    for (const s of seasons) {
      if (date >= s.startDate && date <= s.endDate && s.adjustPct !== 0) {
        rate *= 1 + s.adjustPct / 100;
        applied.push(`${s.name} ${fmtPct(s.adjustPct)}`);
      }
    }
    // Last-minute takes precedence over early-bird (they're mutually exclusive
    // thresholds in practice, but guard the overlap explicitly).
    if (policy.leadLateDays != null && policy.leadLateAdjustPct != null && leadDays <= policy.leadLateDays) {
      rate *= 1 + policy.leadLateAdjustPct / 100;
      applied.push(`Last-minute ${fmtPct(policy.leadLateAdjustPct)}`);
    } else if (policy.leadEarlyDays != null && policy.leadEarlyAdjustPct != null && leadDays >= policy.leadEarlyDays) {
      rate *= 1 + policy.leadEarlyAdjustPct / 100;
      applied.push(`Early-bird ${fmtPct(policy.leadEarlyAdjustPct)}`);
    }
    if (policy.occupancyThresholdPct != null && policy.occupancyAdjustPct != null && occupancyPct >= policy.occupancyThresholdPct) {
      rate *= 1 + policy.occupancyAdjustPct / 100;
      applied.push(`High demand ${fmtPct(policy.occupancyAdjustPct)}`);
    }
  }

  const clamped = Math.min(Math.max(rate, rates.rateFloor), rates.rateCeiling);
  if (round(clamped) !== round(rate)) applied.push("Clamped to floor/ceiling");
  return { date, rate: round(clamped), applied };
}

// Whole-day lead time from today to check-in (UTC-anchored, so no DST drift).
function leadDaysTo(checkIn: string): number {
  const ms = parseDateOnly(checkIn).getTime() - parseDateOnly(todayDateOnly()).getTime();
  return Math.round(ms / 86_400_000);
}

function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

export async function getPolicy(): Promise<Policy> {
  const row = await prisma.pricingPolicy.findFirst();
  if (!row) return DEFAULT_POLICY;
  return {
    enabled: row.enabled,
    weekendDays: row.weekendDays,
    weekendAdjustPct: Number(row.weekendAdjustPct),
    leadEarlyDays: row.leadEarlyDays,
    leadEarlyAdjustPct: row.leadEarlyAdjustPct == null ? null : Number(row.leadEarlyAdjustPct),
    leadLateDays: row.leadLateDays,
    leadLateAdjustPct: row.leadLateAdjustPct == null ? null : Number(row.leadLateAdjustPct),
    occupancyThresholdPct: row.occupancyThresholdPct,
    occupancyAdjustPct: row.occupancyAdjustPct == null ? null : Number(row.occupancyAdjustPct),
  };
}

// Full quote for a room type over [checkIn, checkOut). Pulls policy, seasons,
// overrides and live occupancy, then runs the pure calculator per night.
export async function quoteRoomType(roomTypeId: string, checkIn: string, checkOut: string): Promise<Quote> {
  const nights = nightsBetween(checkIn, checkOut);

  const [roomType, policy, seasonRows, overrideRows, availability, property] = await Promise.all([
    prisma.roomType.findUnique({ where: { id: roomTypeId } }),
    getPolicy(),
    prisma.season.findMany(),
    prisma.rateOverride.findMany({
      where: { roomTypeId, date: { gte: parseDateOnly(checkIn), lt: parseDateOnly(checkOut) } },
    }),
    getAvailability(roomTypeId, checkIn, checkOut),
    prisma.propertySettings.findFirst(),
  ]);

  if (!roomType) throw new Error("room type not found");

  const rates: RoomTypeRates = {
    baseRate: Number(roomType.baseRate),
    rateFloor: Number(roomType.rateFloor),
    rateCeiling: Number(roomType.rateCeiling),
  };
  const seasons: SeasonRule[] = seasonRows.map((s) => ({
    name: s.name,
    startDate: formatDateOnly(s.startDate),
    endDate: formatDateOnly(s.endDate),
    adjustPct: Number(s.adjustPct),
  }));
  const overrideByDate = new Map(overrideRows.map((o) => [formatDateOnly(o.date), Number(o.rate)]));
  const occByDate = new Map(
    availability.map((a) => [a.date, a.total > 0 ? ((a.total - a.available) / a.total) * 100 : 0]),
  );
  const leadDays = leadDaysTo(checkIn);

  const nightRates = nights.map((date) =>
    computeNightRate({
      date,
      rates,
      policy,
      seasons,
      leadDays,
      occupancyPct: occByDate.get(date) ?? 0,
      override: overrideByDate.get(date) ?? null,
    }),
  );

  return {
    roomTypeId,
    currency: property?.currency ?? "INR",
    nights: nightRates,
    total: nightRates.reduce((sum, n) => sum + n.rate, 0),
  };
}
