import { prisma } from "@/lib/prisma";
import type { TourStatus } from "@prisma/client";

// Lightweight tours/activities module — mirrors Vendors. Advisory only; it never
// touches reservations or availability.

// ── Partners ─────────────────────────────────────────────────────────────
export async function listTourPartners() {
  return prisma.tourPartner.findMany({ orderBy: { name: "asc" } });
}
export async function createTourPartner(data: { name: string; contact?: string | null; commissionPct?: number | null }) {
  return prisma.tourPartner.create({ data: { name: data.name, contact: data.contact ?? null, commissionPct: data.commissionPct ?? null } });
}

// ── Tours ────────────────────────────────────────────────────────────────
export async function listTours() {
  return prisma.tour.findMany({ orderBy: { name: "asc" }, include: { partner: { select: { name: true } } } });
}
export async function createTour(data: { name: string; description?: string | null; price?: number | null; partnerId?: string | null }) {
  return prisma.tour.create({ data: { name: data.name, description: data.description ?? null, price: data.price ?? null, partnerId: data.partnerId ?? null } });
}

// ── Bookings ─────────────────────────────────────────────────────────────
export async function listTourBookings() {
  return prisma.tourBooking.findMany({
    orderBy: { createdAt: "desc" },
    include: { tour: { select: { name: true } }, partner: { select: { name: true } } },
  });
}
export async function createTourBooking(data: {
  tourId: string; partnerId?: string | null; guestId?: string | null; reservationId?: string | null;
  date?: string | null; amount?: number | null; commissionPct?: number | null; note?: string | null;
}) {
  return prisma.tourBooking.create({
    data: {
      tourId: data.tourId,
      partnerId: data.partnerId ?? null,
      guestId: data.guestId ?? null,
      reservationId: data.reservationId ?? null,
      date: data.date ? new Date(data.date) : null,
      amount: data.amount ?? null,
      commissionPct: data.commissionPct ?? null,
      note: data.note ?? null,
    },
  });
}
export async function setTourBookingStatus(id: string, status: TourStatus) {
  const existing = await prisma.tourBooking.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.tourBooking.update({ where: { id }, data: { status } });
}

// ── Pure commission summary (testable) ───────────────────────────────────
export type BookingForSummary = { amount: number | null; commissionPct: number | null; status: TourStatus };
export type TourSummary = { bookings: number; revenue: number; commission: number };

// Sums realised (non-cancelled) tour bookings: gross revenue and the commission
// owed to partners. Commission is per-booking (snapshotted pct × amount).
export function commissionSummary(bookings: BookingForSummary[]): TourSummary {
  let count = 0;
  let revenue = 0;
  let commission = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    count += 1;
    const amount = b.amount ?? 0;
    revenue += amount;
    commission += Math.round((amount * (b.commissionPct ?? 0)) / 100);
  }
  return { bookings: count, revenue, commission };
}
