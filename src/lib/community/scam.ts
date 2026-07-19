import { createHash, createHmac } from "node:crypto";
import { prisma, unscopedPrisma } from "@/lib/prisma";
import type { ScamReportStatus } from "@prisma/client";

// Community scam network (Phase 3, slice e). An opt-in, verified, moderated
// shared list built on top of the private per-property FlaggedNumber list. Safe
// by construction: phones are stored + matched by HASH (raw number never
// shared), only verified+unexpired reports are visible to peers, sharing is
// gated by the SCAM grant, reports carry attribution + a retention limit, and a
// dispute path lets a report be contested.

const DEFAULT_RETENTION_DAYS = 180;

// ─── Pure helpers ───────────────────────────────────────────────────────────

// A per-network pepper (US-605). Set → keyed HMAC; unset → legacy SHA-256 (v1),
// so existing deployments are non-breaking until the owner sets it.
function pepper(): string | undefined {
  return process.env.COMMUNITY_HASH_PEPPER?.trim() || undefined;
}

// The CURRENT hash for NEW rows. With a pepper it's a keyed HMAC — an attacker
// who exfiltrates the hashes still can't precompute the 10-digit phone space
// without the pepper. Without one it's the legacy unsalted SHA-256.
export function hashPhone(phone: string): string {
  const n = normalizePhone(phone);
  const p = pepper();
  return p ? createHmac("sha256", p).update(n).digest("hex") : createHash("sha256").update(n).digest("hex");
}

// Scheme new rows are written with: 2 = keyed HMAC, 1 = legacy SHA-256.
export function currentHashVersion(): number {
  return pepper() ? 2 : 1;
}

// All candidate hashes to MATCH a phone against: the current scheme PLUS the legacy
// SHA-256, so existing v1 rows still match after the pepper is introduced — they
// can't be re-hashed (the raw number was never stored). US-605 "migration".
export function hashPhoneCandidates(phone: string): string[] {
  const n = normalizePhone(phone);
  const sha = createHash("sha256").update(n).digest("hex");
  const p = pepper();
  return p ? [createHmac("sha256", p).update(n).digest("hex"), sha] : [sha];
}
// Digits only, then the last 10 (drops a +91 / leading-0 country prefix) so the
// same Indian mobile matches regardless of how it was typed.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
export function phoneLast4(phone: string): string {
  return normalizePhone(phone).slice(-4);
}

// A report is shareable/matchable only while verified and unexpired.
export function isActive(report: { status: ScamReportStatus; expiresAt: Date | null }, now = new Date()): boolean {
  return report.status === "verified" && (!report.expiresAt || report.expiresAt > now);
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type ScamReportView = {
  id: string;
  reporterPropertyId: string;
  reporterName: string;
  phoneLast4: string | null;
  reason: string;
  evidenceNote: string | null;
  status: ScamReportStatus;
  expiresAt: string | null;
  createdAt: string;
  mine: boolean;
};

function iso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ─── Write ──────────────────────────────────────────────────────────────────

export async function reportScam(
  reporterPropertyId: string,
  input: { phone: string; reason: string; evidenceNote?: string | null; createdByUserId?: string | null; retentionDays?: number },
): Promise<Result<{ id: string }>> {
  const digits = normalizePhone(input.phone);
  if (digits.length < 5) return { ok: false, error: "Enter a valid phone number." };
  if (!input.reason.trim()) return { ok: false, error: "A reason is required." };

  const days = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const report = await prisma.sharedScamReport.create({
    data: {
      reporterPropertyId,
      phoneHash: hashPhone(input.phone),
      hashVersion: currentHashVersion(),
      phoneLast4: phoneLast4(input.phone),
      reason: input.reason.trim(),
      evidenceNote: input.evidenceNote?.trim() || null,
      createdByUserId: input.createdByUserId ?? null,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
  return { ok: true, id: report.id };
}

// Verify (publish) a report — the reporter attests to evidence. Evidence is
// REQUIRED to publish. Only then is it visible to peers.
export async function verifyScamReport(id: string, reporterPropertyId: string): Promise<Result> {
  const report = await prisma.sharedScamReport.findUnique({ where: { id } });
  if (!report || report.reporterPropertyId !== reporterPropertyId) return { ok: false, error: "Report not found." };
  if (!report.evidenceNote || !report.evidenceNote.trim()) return { ok: false, error: "Add an evidence note before verifying." };
  await prisma.sharedScamReport.update({ where: { id }, data: { status: "verified", verifiedAt: new Date() } });
  return { ok: true };
}

// Dispute/appeal — the reporter, or any peer the report is shared with, can
// contest it. A disputed report is hidden from sharing pending review.
export async function disputeScamReport(id: string, viewerPropertyId: string): Promise<Result> {
  const report = await prisma.sharedScamReport.findUnique({ where: { id } });
  if (!report) return { ok: false, error: "Report not found." };

  const canSee = report.reporterPropertyId === viewerPropertyId || (await sharesScamWith(report.reporterPropertyId, viewerPropertyId));
  if (!canSee) return { ok: false, error: "That report is not visible to you." };

  await prisma.sharedScamReport.update({ where: { id }, data: { status: "disputed" } });
  return { ok: true };
}

// ─── Read ───────────────────────────────────────────────────────────────────

// Does `reporter` share their scam list with `viewer` (accepted connection is
// implied by the grant, which can only be set on an accepted connection)?
async function sharesScamWith(reporterPropertyId: string, viewerPropertyId: string): Promise<boolean> {
  const grant = await prisma.sharingGrant.findFirst({
    where: { grantorPropertyId: reporterPropertyId, granteePropertyId: viewerPropertyId, dataType: "scam", enabled: true },
    select: { id: true },
  });
  return !!grant;
}

// Property ids that share their scam list with the viewer.
async function scamSharersFor(viewerPropertyId: string): Promise<string[]> {
  const grants = await prisma.sharingGrant.findMany({
    where: { granteePropertyId: viewerPropertyId, dataType: "scam", enabled: true },
    select: { grantorPropertyId: true },
  });
  return grants.map((g) => g.grantorPropertyId);
}

async function nameMap(propertyIds: string[]): Promise<Map<string, string>> {
  const profiles = await prisma.propertySettings.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true, publicName: true } });
  return new Map(profiles.map((p) => [p.id, p.publicName || p.name]));
}

function toView(r: Awaited<ReturnType<typeof prisma.sharedScamReport.findMany>>[number], names: Map<string, string>, mine: boolean): ScamReportView {
  return {
    id: r.id,
    reporterPropertyId: r.reporterPropertyId,
    reporterName: names.get(r.reporterPropertyId) ?? "A peer",
    phoneLast4: r.phoneLast4,
    reason: r.reason,
    evidenceNote: r.evidenceNote,
    status: r.status,
    expiresAt: iso(r.expiresAt),
    createdAt: iso(r.createdAt)!,
    mine,
  };
}

export async function listMyScamReports(propertyId: string): Promise<ScamReportView[]> {
  const rows = await prisma.sharedScamReport.findMany({ where: { reporterPropertyId: propertyId }, orderBy: { createdAt: "desc" } });
  const names = await nameMap([propertyId]);
  return rows.map((r) => toView(r, names, true));
}

// Verified, unexpired reports from peers who share their scam list with me.
export async function sharedScamListFor(viewerPropertyId: string): Promise<ScamReportView[]> {
  const sharerIds = await scamSharersFor(viewerPropertyId);
  if (sharerIds.length === 0) return [];
  const rows = await unscopedPrisma.sharedScamReport.findMany({
    where: { reporterPropertyId: { in: sharerIds }, status: "verified", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  const names = await nameMap(sharerIds);
  return rows.map((r) => toView(r, names, false));
}

// Look a number up across my own verified reports + peers sharing with me.
export async function lookupScam(viewerPropertyId: string, phone: string): Promise<ScamReportView[]> {
  const sharerIds = await scamSharersFor(viewerPropertyId);
  const rows = await unscopedPrisma.sharedScamReport.findMany({
    where: {
      phoneHash: { in: hashPhoneCandidates(phone) },
      status: "verified",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      reporterPropertyId: { in: [viewerPropertyId, ...sharerIds] },
    },
    orderBy: { createdAt: "desc" },
  });
  const names = await nameMap([viewerPropertyId, ...sharerIds]);
  return rows.map((r) => toView(r, names, r.reporterPropertyId === viewerPropertyId));
}
