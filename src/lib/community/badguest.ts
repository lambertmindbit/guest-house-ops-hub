import { prisma, unscopedPrisma } from "@/lib/prisma";
import { hashPhone, phoneLast4, normalizePhone } from "@/lib/community/scam";
import type { GuestAlertStatus, GuestAlertCategory } from "@prisma/client";

// Community bad-guest alerts (Phase 3, slice f). The evidence-backed sibling of
// the scam network, built on the per-property Guest blacklist. Same safeguards:
// phone matched by HASH (raw never shared), evidence required to verify, only
// verified+unexpired visible to peers (gated by the BAD_GUEST grant), retention
// via expiresAt, a dispute/appeal path, attribution + audit.

const DEFAULT_RETENTION_DAYS = 180;
export const ALERT_CATEGORIES: GuestAlertCategory[] = ["damage", "disturbance", "rule_breach", "threat", "no_show", "other"];

// Keep only the first name for recognition (data minimisation).
export function maskName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function isActive(alert: { status: GuestAlertStatus; expiresAt: Date | null }, now = new Date()): boolean {
  return alert.status === "verified" && (!alert.expiresAt || alert.expiresAt > now);
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type GuestAlertView = {
  id: string;
  reporterPropertyId: string;
  reporterName: string;
  guestNameMasked: string | null;
  guestPhoneLast4: string | null;
  category: GuestAlertCategory;
  reason: string;
  evidenceNote: string | null;
  status: GuestAlertStatus;
  expiresAt: string | null;
  createdAt: string;
  mine: boolean;
};

function iso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ─── Write ──────────────────────────────────────────────────────────────────

export async function reportGuestAlert(
  reporterPropertyId: string,
  input: { phone: string; guestName?: string | null; category: GuestAlertCategory; reason: string; evidenceNote?: string | null; createdByUserId?: string | null; retentionDays?: number },
): Promise<Result<{ id: string }>> {
  if (normalizePhone(input.phone).length < 5) return { ok: false, error: "Enter a valid guest phone number." };
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };

  const days = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const alert = await prisma.sharedGuestAlert.create({
    data: {
      reporterPropertyId,
      guestPhoneHash: hashPhone(input.phone),
      guestPhoneLast4: phoneLast4(input.phone),
      guestNameMasked: input.guestName ? maskName(input.guestName) : null,
      category: input.category,
      reason: input.reason.trim(),
      evidenceNote: input.evidenceNote?.trim() || null,
      createdByUserId: input.createdByUserId ?? null,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
  return { ok: true, id: alert.id };
}

// Evidence is REQUIRED to publish (verify) an alert.
export async function verifyGuestAlert(id: string, reporterPropertyId: string): Promise<Result> {
  const alert = await prisma.sharedGuestAlert.findUnique({ where: { id } });
  if (!alert || alert.reporterPropertyId !== reporterPropertyId) return { ok: false, error: "Alert not found." };
  if (!alert.evidenceNote || !alert.evidenceNote.trim()) return { ok: false, error: "Add an evidence note before verifying." };
  await prisma.sharedGuestAlert.update({ where: { id }, data: { status: "verified", verifiedAt: new Date() } });
  return { ok: true };
}

// Dispute/appeal — reporter, or a peer the alert is shared with, can contest it.
export async function disputeGuestAlert(id: string, viewerPropertyId: string): Promise<Result> {
  const alert = await prisma.sharedGuestAlert.findUnique({ where: { id } });
  if (!alert) return { ok: false, error: "Alert not found." };
  const canSee = alert.reporterPropertyId === viewerPropertyId || (await sharesAlertsWith(alert.reporterPropertyId, viewerPropertyId));
  if (!canSee) return { ok: false, error: "That alert is not visible to you." };
  await prisma.sharedGuestAlert.update({ where: { id }, data: { status: "disputed" } });
  return { ok: true };
}

// ─── Read ───────────────────────────────────────────────────────────────────

async function sharesAlertsWith(reporterPropertyId: string, viewerPropertyId: string): Promise<boolean> {
  const grant = await prisma.sharingGrant.findFirst({
    where: { grantorPropertyId: reporterPropertyId, granteePropertyId: viewerPropertyId, dataType: "bad_guest", enabled: true },
    select: { id: true },
  });
  return !!grant;
}

async function alertSharersFor(viewerPropertyId: string): Promise<string[]> {
  const grants = await prisma.sharingGrant.findMany({
    where: { granteePropertyId: viewerPropertyId, dataType: "bad_guest", enabled: true },
    select: { grantorPropertyId: true },
  });
  return grants.map((g) => g.grantorPropertyId);
}

async function nameMap(propertyIds: string[]): Promise<Map<string, string>> {
  const profiles = await prisma.propertySettings.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true, publicName: true } });
  return new Map(profiles.map((p) => [p.id, p.publicName || p.name]));
}

function toView(a: Awaited<ReturnType<typeof prisma.sharedGuestAlert.findMany>>[number], names: Map<string, string>, mine: boolean): GuestAlertView {
  return {
    id: a.id,
    reporterPropertyId: a.reporterPropertyId,
    reporterName: names.get(a.reporterPropertyId) ?? "A peer",
    guestNameMasked: a.guestNameMasked,
    guestPhoneLast4: a.guestPhoneLast4,
    category: a.category,
    reason: a.reason,
    evidenceNote: a.evidenceNote,
    status: a.status,
    expiresAt: iso(a.expiresAt),
    createdAt: iso(a.createdAt)!,
    mine,
  };
}

export async function listMyGuestAlerts(propertyId: string): Promise<GuestAlertView[]> {
  const rows = await prisma.sharedGuestAlert.findMany({ where: { reporterPropertyId: propertyId }, orderBy: { createdAt: "desc" } });
  const names = await nameMap([propertyId]);
  return rows.map((a) => toView(a, names, true));
}

export async function sharedGuestAlertsFor(viewerPropertyId: string): Promise<GuestAlertView[]> {
  const sharerIds = await alertSharersFor(viewerPropertyId);
  if (sharerIds.length === 0) return [];
  const rows = await unscopedPrisma.sharedGuestAlert.findMany({
    where: { reporterPropertyId: { in: sharerIds }, status: "verified", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  const names = await nameMap(sharerIds);
  return rows.map((a) => toView(a, names, false));
}

export async function lookupGuestAlert(viewerPropertyId: string, phone: string): Promise<GuestAlertView[]> {
  const hash = hashPhone(phone);
  const sharerIds = await alertSharersFor(viewerPropertyId);
  const rows = await unscopedPrisma.sharedGuestAlert.findMany({
    where: {
      guestPhoneHash: hash,
      status: "verified",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      reporterPropertyId: { in: [viewerPropertyId, ...sharerIds] },
    },
    orderBy: { createdAt: "desc" },
  });
  const names = await nameMap([viewerPropertyId, ...sharerIds]);
  return rows.map((a) => toView(a, names, a.reporterPropertyId === viewerPropertyId));
}
