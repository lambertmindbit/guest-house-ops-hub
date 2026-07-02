import { prisma, prismaForTenant } from "@/lib/prisma";
import { canRead, connectionBetween, grantsFor } from "@/lib/community/network";
import type { ReferralStatus } from "@prisma/client";

// Overflow referral marketplace (Phase 3, slice d) — the headline "Rapido for
// homestays" feature. A property that's full refers a guest to a peer; the peer
// accepts and books the guest THROUGH THE NORMAL GUARDED PATH (inheriting the
// 409), then links the booking here for revenue attribution + a reciprocal
// credit. This module never creates a reservation, so the GiST guarantee holds.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ─── Pure helpers (unit-tested) ─────────────────────────────────────────────

// Net credit from `me`'s perspective vs `peer`: positive = peer owes me (I sent
// them converting business); negative = I owe them. Derived by summing entries.
export function creditBalanceFrom(
  entries: { fromPropertyId: string; toPropertyId: string; amount: number }[],
  me: string,
  peer: string,
): number {
  let balance = 0;
  for (const e of entries) {
    if (e.fromPropertyId === me && e.toPropertyId === peer) balance += e.amount;
    else if (e.fromPropertyId === peer && e.toPropertyId === me) balance -= e.amount;
  }
  return balance;
}

export type ReferralAnalytics = {
  sent: number; accepted: number; converted: number; declined: number;
  conversionRate: number; revenueEarned: number;
};

// Analytics over a property's OUTBOUND referrals (the ones it sent).
export function analyticsFrom(outbound: { status: ReferralStatus; attributedRevenue: number | null }[]): ReferralAnalytics {
  const sent = outbound.length;
  const accepted = outbound.filter((r) => r.status === "accepted" || r.status === "converted").length;
  const converted = outbound.filter((r) => r.status === "converted").length;
  const declined = outbound.filter((r) => r.status === "declined").length;
  const revenueEarned = outbound.reduce((s, r) => s + (r.attributedRevenue ?? 0), 0);
  return { sent, accepted, converted, declined, conversionRate: sent ? converted / sent : 0, revenueEarned };
}

// ─── Data flow ──────────────────────────────────────────────────────────────

// Send a guest to a peer. The peer must accept referrals from the sender (a
// referrals grant recipient→sender), so recipients control who can refer to them.
export async function proposeReferral(
  fromPropertyId: string,
  toPropertyId: string,
  input: { guestName: string; guestPhone?: string | null; checkIn: string; checkOut: string; roomTypeNeed?: string | null; note?: string | null },
): Promise<Result<{ referralId: string }>> {
  if (fromPropertyId === toPropertyId) return { ok: false, error: "Pick a different property." };
  const connection = await connectionBetween(fromPropertyId, toPropertyId);
  if (connection?.status !== "accepted") return { ok: false, error: "Connect with this property first." };

  const grants = await grantsFor(toPropertyId, fromPropertyId);
  const permitted = canRead({ connectionStatus: connection.status, grants, ownerPropertyId: toPropertyId, viewerPropertyId: fromPropertyId, type: "referrals" });
  if (!permitted) return { ok: false, error: "This property is not accepting referrals from you." };

  const referral = await prisma.referral.create({
    data: {
      fromPropertyId, toPropertyId,
      guestName: input.guestName,
      guestPhone: input.guestPhone ?? null,
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      roomTypeNeed: input.roomTypeNeed ?? null,
      note: input.note ?? null,
    },
  });
  return { ok: true, referralId: referral.id };
}

// Recipient accepts/declines a proposed referral.
export async function respondToReferral(referralId: string, propertyId: string, accept: boolean): Promise<Result> {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral || referral.toPropertyId !== propertyId) return { ok: false, error: "Referral not found." };
  if (referral.status !== "proposed") return { ok: false, error: "This referral has already been answered." };
  await prisma.referral.update({
    where: { id: referralId },
    data: { status: accept ? "accepted" : "declined", respondedAt: new Date() },
  });
  return { ok: true };
}

// Link a booking the recipient already created (the normal guarded way) to an
// accepted referral: attributes the booking's gross to the referrer as a credit.
// Verifies the reservation belongs to the recipient property (scoped read), so a
// referral can never attribute someone else's booking.
export async function convertReferral(referralId: string, propertyId: string, reservationId: string): Promise<Result> {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral || referral.toPropertyId !== propertyId) return { ok: false, error: "Referral not found." };
  if (referral.status !== "accepted") return { ok: false, error: "Accept the referral before linking a booking." };

  const reservation = await prismaForTenant(propertyId).reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) return { ok: false, error: "That booking is not in your property." };

  const amount = reservation.grossAmount ? Number(reservation.grossAmount) : 0;
  await prisma.$transaction([
    prisma.referral.update({
      where: { id: referralId },
      data: { status: "converted", resultingReservationId: reservationId, attributedRevenue: amount },
    }),
    prisma.referralCreditEntry.create({
      data: { fromPropertyId: referral.fromPropertyId, toPropertyId: referral.toPropertyId, referralId, amount },
    }),
  ]);
  return { ok: true };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export type ReferralView = {
  id: string;
  direction: "inbound" | "outbound";
  peerPropertyId: string;
  peerName: string;
  guestName: string;
  guestPhone: string | null; // withheld from the recipient until accepted
  checkIn: string;
  checkOut: string;
  roomTypeNeed: string | null;
  note: string | null;
  status: ReferralStatus;
  attributedRevenue: number | null;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function listReferrals(propertyId: string): Promise<ReferralView[]> {
  const rows = await prisma.referral.findMany({
    where: { OR: [{ fromPropertyId: propertyId }, { toPropertyId: propertyId }] },
    orderBy: { createdAt: "desc" },
  });
  const peerIds = Array.from(new Set(rows.map((r) => (r.fromPropertyId === propertyId ? r.toPropertyId : r.fromPropertyId))));
  const profiles = await prisma.propertySettings.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true, publicName: true } });
  const nameById = new Map(profiles.map((p) => [p.id, p.publicName || p.name]));

  return rows.map((r) => {
    const inbound = r.toPropertyId === propertyId;
    // Data minimisation: the recipient sees the guest phone only once accepted.
    const phoneVisible = !inbound || r.status === "accepted" || r.status === "converted";
    return {
      id: r.id,
      direction: inbound ? "inbound" : "outbound",
      peerPropertyId: inbound ? r.fromPropertyId : r.toPropertyId,
      peerName: nameById.get(inbound ? r.fromPropertyId : r.toPropertyId) ?? "Unknown property",
      guestName: r.guestName,
      guestPhone: phoneVisible ? r.guestPhone : null,
      checkIn: iso(r.checkIn),
      checkOut: iso(r.checkOut),
      roomTypeNeed: r.roomTypeNeed,
      note: r.note,
      status: r.status,
      attributedRevenue: r.attributedRevenue ? Number(r.attributedRevenue) : null,
    };
  });
}

// Peers I may refer TO: an accepted connection where the peer granted me their
// "referrals" share (recipients choose who can refer to them).
export async function peersAcceptingReferrals(propertyId: string): Promise<{ propertyId: string; name: string }[]> {
  const conns = await prisma.networkConnection.findMany({
    where: { status: "accepted", OR: [{ requesterPropertyId: propertyId }, { addresseePropertyId: propertyId }] },
  });
  const peerIds = conns.map((c) => (c.requesterPropertyId === propertyId ? c.addresseePropertyId : c.requesterPropertyId));
  if (peerIds.length === 0) return [];
  const grants = await prisma.sharingGrant.findMany({
    where: { granteePropertyId: propertyId, dataType: "referrals", enabled: true, grantorPropertyId: { in: peerIds } },
    select: { grantorPropertyId: true },
  });
  const accepting = new Set(grants.map((g) => g.grantorPropertyId));
  const profiles = await prisma.propertySettings.findMany({
    where: { id: { in: peerIds.filter((id) => accepting.has(id)) } },
    select: { id: true, name: true, publicName: true },
  });
  return profiles.map((p) => ({ propertyId: p.id, name: p.publicName || p.name }));
}

// Net credit balance per peer, derived from the ledger.
export async function creditBalances(propertyId: string): Promise<{ peerPropertyId: string; peerName: string; balance: number }[]> {
  const entries = await prisma.referralCreditEntry.findMany({
    where: { OR: [{ fromPropertyId: propertyId }, { toPropertyId: propertyId }] },
    select: { fromPropertyId: true, toPropertyId: true, amount: true },
  });
  const normalized = entries.map((e) => ({ fromPropertyId: e.fromPropertyId, toPropertyId: e.toPropertyId, amount: Number(e.amount) }));
  const peerIds = Array.from(new Set(normalized.flatMap((e) => [e.fromPropertyId, e.toPropertyId]).filter((id) => id !== propertyId)));
  const profiles = await prisma.propertySettings.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true, publicName: true } });
  const nameById = new Map(profiles.map((p) => [p.id, p.publicName || p.name]));
  return peerIds.map((peer) => ({ peerPropertyId: peer, peerName: nameById.get(peer) ?? "Unknown property", balance: creditBalanceFrom(normalized, propertyId, peer) }));
}
