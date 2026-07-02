import { prisma } from "@/lib/prisma";
import type { ReservationStatus } from "@prisma/client";

// No-show reliability (Phase 3, slice g). A per-guest signal DERIVED from
// reservation history — never stored. Single-property first; a conservative
// threshold gates the opt-in shared repeat-offender flag (which reuses the
// bad-guest alert machinery, category = no_show, and is appealable).

export type NoShowStats = {
  total: number;      // realised bookings (confirmed + no_show; cancellations excluded)
  noShows: number;
  kept: number;
  noShowRate: number; // 0..1
  score: number;      // 0..100, higher = more reliable
};

// Pure: derive the stats from a list of reservation statuses.
export function noShowStats(statuses: ReservationStatus[]): NoShowStats {
  const noShows = statuses.filter((s) => s === "no_show").length;
  const kept = statuses.filter((s) => s === "confirmed").length;
  const total = noShows + kept;
  const noShowRate = total ? noShows / total : 0;
  return { total, noShows, kept, noShowRate, score: Math.round(100 - noShowRate * 100) };
}

// Deliberately strict — a shared flag is serious and appealable. Needs a
// meaningful sample (≥3 bookings), repeated no-shows (≥2), and a high rate.
export const REPEAT_OFFENDER = { minBookings: 3, minNoShows: 2, minRate: 0.4 };

export function isRepeatOffender(stats: NoShowStats, t = REPEAT_OFFENDER): boolean {
  return stats.total >= t.minBookings && stats.noShows >= t.minNoShows && stats.noShowRate >= t.minRate;
}

// Query helper: a guest's no-show stats within the acting property.
export async function guestNoShowStats(guestId: string): Promise<NoShowStats> {
  const rows = await prisma.reservation.findMany({ where: { guestId }, select: { status: true } });
  return noShowStats(rows.map((r) => r.status));
}
