import { prisma } from "@/lib/prisma";
import type { ReferralOutcome } from "@prisma/client";

// Owner-managed contact list of places/people the property works with (other
// guesthouses, hotels, drivers, agents) and a one-sided log of guests referred
// out to them. Distinct from the cross-tenant community network — these are
// plain tenant-scoped records the owner types in and grows over time.

// ── Partners ─────────────────────────────────────────────────────────────
export async function listPartners() {
  return prisma.partner.findMany({ orderBy: { name: "asc" } });
}
export async function createPartner(data: {
  name: string; kind?: string | null; phone?: string | null; locality?: string | null; rating?: number | null; notes?: string | null;
}) {
  return prisma.partner.create({
    data: {
      name: data.name, kind: data.kind ?? null, phone: data.phone ?? null,
      locality: data.locality ?? null, rating: data.rating ?? null, notes: data.notes ?? null,
    },
  });
}
export async function updatePartner(id: string, data: {
  name?: string; kind?: string | null; phone?: string | null; locality?: string | null; rating?: number | null; notes?: string | null;
}) {
  const current = await prisma.partner.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.partner.update({ where: { id }, data });
}
export async function deletePartner(id: string) {
  const current = await prisma.partner.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.partner.delete({ where: { id } });
}

// ── Outbound referrals ───────────────────────────────────────────────────
export async function listReferrals() {
  return prisma.outboundReferral.findMany({
    orderBy: { createdAt: "desc" },
    include: { partner: { select: { name: true } } },
  });
}
export async function createReferral(data: {
  guestName: string; partnerId?: string | null; guestPhone?: string | null;
  checkIn?: Date | null; checkOut?: Date | null; note?: string | null;
}) {
  return prisma.outboundReferral.create({
    data: {
      guestName: data.guestName, partnerId: data.partnerId ?? null, guestPhone: data.guestPhone ?? null,
      checkIn: data.checkIn ?? null, checkOut: data.checkOut ?? null, note: data.note ?? null,
    },
  });
}
export async function updateReferral(id: string, data: {
  status?: ReferralOutcome; partnerId?: string | null; note?: string | null;
}) {
  const current = await prisma.outboundReferral.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.outboundReferral.update({ where: { id }, data });
}
export async function deleteReferral(id: string) {
  const current = await prisma.outboundReferral.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.outboundReferral.delete({ where: { id } });
}

// Pure: headline counts for the referral log (testable). "converted" = booked.
export type ReferralForSummary = { status: ReferralOutcome };
export function referralSummary(referrals: ReferralForSummary[]): {
  total: number; referred: number; booked: number; declined: number; conversionRate: number;
} {
  let referred = 0, booked = 0, declined = 0;
  for (const r of referrals) {
    if (r.status === "referred") referred += 1;
    else if (r.status === "booked") booked += 1;
    else if (r.status === "declined") declined += 1;
  }
  const total = referrals.length;
  // Of referrals that reached an outcome, how many booked.
  const decided = booked + declined;
  return { total, referred, booked, declined, conversionRate: decided > 0 ? booked / decided : 0 };
}
