import { prisma } from "@/lib/prisma";
import type { TripStatus } from "@prisma/client";
import { parseDateOnly } from "@/lib/dates";

// Records only — live dispatch stays in the ROOT CabAgent.

export async function listDrivers() {
  return prisma.driver.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}
export async function createDriver(data: { name: string; phone?: string | null; vehicleNumber?: string | null }) {
  return prisma.driver.create({ data: { name: data.name, phone: data.phone ?? null, vehicleNumber: data.vehicleNumber ?? null } });
}

export async function listTrips() {
  return prisma.trip.findMany({ orderBy: { createdAt: "desc" }, include: { driver: { select: { name: true } } } });
}
export async function createTrip(data: {
  driverId?: string | null; guestId?: string | null; pickup: string; dropoff: string; scheduledAt?: string | null;
  fare?: number | null; status?: TripStatus; note?: string | null;
}) {
  return prisma.trip.create({
    data: {
      driverId: data.driverId ?? null, guestId: data.guestId ?? null, pickup: data.pickup, dropoff: data.dropoff,
      scheduledAt: data.scheduledAt ? parseDateOnly(data.scheduledAt) : null,
      fare: data.fare ?? null, status: data.status ?? "planned", note: data.note ?? null,
    },
  });
}
export async function transitionTrip(id: string, status: TripStatus) {
  const current = await prisma.trip.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.trip.update({ where: { id }, data: { status } });
}

// ── Pure (testable) ──────────────────────────────────────────────────────────
export type TripForRollup = { status: TripStatus; fare: number | null };
export function fareRollup(trips: TripForRollup[]): { doneFares: number; doneCount: number; plannedCount: number } {
  let doneFares = 0;
  let doneCount = 0;
  let plannedCount = 0;
  for (const t of trips) {
    if (t.status === "done") { doneCount += 1; doneFares += t.fare ?? 0; }
    if (t.status === "planned") plannedCount += 1;
  }
  return { doneFares, doneCount, plannedCount };
}
