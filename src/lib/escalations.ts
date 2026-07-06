import { prisma } from "@/lib/prisma";
import type {
  EscalationSource,
  EscalationCategory,
  EscalationSeverity,
  EscalationStatus,
  EscalationRelatedType,
  Escalation,
} from "@prisma/client";

// ───────────────────────────────────────────────────────────────────────────
// Domain logic for the Escalations module — the human-in-the-loop inbox shared
// by every ROOT agent. Lives in src/lib/* so it's reusable by both Server
// Components (reads) and API routes (writes), per the project convention.
//
// No money/Decimal here. Timestamps are serialised to ISO strings at the
// boundary (`toView`) so they pass cleanly to "use client" components.
// ───────────────────────────────────────────────────────────────────────────

export type CreateEscalationInput = {
  source: EscalationSource;
  category?: EscalationCategory;
  severity?: EscalationSeverity;
  title: string;
  summary: string;
  reason?: string | null;
  raisedByName?: string | null;
  raisedByContact?: string | null;
  raisedByLang?: string | null;
  originalText?: string | null;
  translatedText?: string | null;
  relatedType?: EscalationRelatedType;
  relatedId?: string | null;
  threadRef?: string | null;
  externalId?: string | null;
  /** Forward-compatible tenant hint. Ignored until the multi-tenancy gate lands. */
  propertyRef?: string | null;
};

export type TransitionEscalationInput = {
  status?: EscalationStatus;
  severity?: EscalationSeverity;
  assignedTo?: string | null;
  resolutionNote?: string | null;
};

export type EscalationListFilters = {
  status?: EscalationStatus;
  category?: EscalationCategory;
  severity?: EscalationSeverity;
  /** Limit to escalations created on/after this instant (KPI windows / "Today"). */
  since?: Date;
};

/** Shape sent to client components — Dates flattened to ISO strings. */
export type EscalationView = Omit<
  Escalation,
  "createdAt" | "updatedAt" | "firstResponseAt" | "resolvedAt"
> & {
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
};

function toView(e: Escalation): EscalationView {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    firstResponseAt: e.firstResponseAt ? e.firstResponseAt.toISOString() : null,
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
  };
}

export async function listEscalations(
  filters: EscalationListFilters = {},
): Promise<EscalationView[]> {
  const rows = await prisma.escalation.findMany({
    where: {
      status: filters.status,
      category: filters.category,
      severity: filters.severity,
      createdAt: filters.since ? { gte: filters.since } : undefined,
    },
    // Open first, then most severe, then newest — the triage order.
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map(toView);
}

export async function getEscalation(id: string): Promise<EscalationView | null> {
  const e = await prisma.escalation.findUnique({ where: { id } });
  return e ? toView(e) : null;
}

/**
 * Create an escalation. If `externalId` is supplied and already exists, the
 * existing row is returned untouched (idempotent) — this lets a retrying agent
 * POST the same event twice without creating duplicate tickets, mirroring the
 * OTA-ref de-dupe on InboundBooking.
 */
export async function createEscalation(
  input: CreateEscalationInput,
): Promise<{ escalation: EscalationView; deduped: boolean }> {
  if (input.externalId) {
    const existing = await prisma.escalation.findUnique({
      where: { externalId: input.externalId },
    });
    if (existing) return { escalation: toView(existing), deduped: true };
  }

  const e = await prisma.escalation.create({
    data: {
      source: input.source,
      category: input.category ?? "other",
      severity: input.severity ?? "medium",
      title: input.title.trim(),
      summary: input.summary.trim(),
      reason: input.reason ?? null,
      raisedByName: input.raisedByName ?? null,
      raisedByContact: input.raisedByContact ?? null,
      raisedByLang: input.raisedByLang ?? null,
      originalText: input.originalText ?? null,
      translatedText: input.translatedText ?? null,
      relatedType: input.relatedType ?? "none",
      relatedId: input.relatedId ?? null,
      threadRef: input.threadRef ?? null,
      externalId: input.externalId ?? null,
      // propertyRef is accepted but not yet persisted — see schema note.
    },
  });

  // Ping the owner's phone: a new queue item needs attention. Best-effort —
  // a push failure must never break filing the escalation.
  try {
    const { sendOwnerPush } = await import("@/lib/push");
    await sendOwnerPush({ title: e.title, body: e.summary, url: "/needs-you", tag: "escalation" });
  } catch {
    // ignore
  }

  return { escalation: toView(e), deduped: false };
}

/**
 * Apply a triage change. Stamps `firstResponseAt` the first time an escalation
 * leaves `open` (drives the Avg-response-time KPI) and `resolvedAt` when it
 * reaches a terminal state.
 */
export async function transitionEscalation(
  id: string,
  patch: TransitionEscalationInput,
): Promise<EscalationView | null> {
  const current = await prisma.escalation.findUnique({ where: { id } });
  if (!current) return null;

  const now = new Date();
  const data: Record<string, unknown> = {};

  if (patch.severity !== undefined) data.severity = patch.severity;
  if (patch.assignedTo !== undefined) data.assignedTo = patch.assignedTo;
  if (patch.resolutionNote !== undefined) data.resolutionNote = patch.resolutionNote;

  if (patch.status !== undefined && patch.status !== current.status) {
    data.status = patch.status;
    // First time it moves off `open`, record the response moment.
    if (current.status === "open" && !current.firstResponseAt) {
      data.firstResponseAt = now;
    }
    // Entering / leaving a terminal state toggles resolvedAt.
    const terminal = patch.status === "resolved" || patch.status === "dismissed";
    data.resolvedAt = terminal ? now : null;
  }

  const updated = await prisma.escalation.update({ where: { id }, data });
  return toView(updated);
}

export type EscalationStats = {
  openTotal: number;
  inProgress: number;
  critical: number; // open/in-progress criticals needing attention
  /** Mean minutes from creation to first response, over resolved-in-window. */
  avgFirstResponseMins: number | null;
  resolvedToday: number;
};

/** KPI strip for the queue header (matches the DPR Escalations screen). */
export async function escalationStats(windowStart?: Date): Promise<EscalationStats> {
  const since = windowStart ?? startOfTodayUTC();

  const [openTotal, inProgress, critical, resolvedToday, responded] =
    await Promise.all([
      prisma.escalation.count({ where: { status: "open" } }),
      prisma.escalation.count({ where: { status: "in_progress" } }),
      prisma.escalation.count({
        where: { severity: "critical", status: { in: ["open", "in_progress"] } },
      }),
      prisma.escalation.count({
        where: { status: { in: ["resolved", "dismissed"] }, resolvedAt: { gte: since } },
      }),
      prisma.escalation.findMany({
        where: { firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
        orderBy: { firstResponseAt: "desc" },
        take: 100, // rolling sample, cheap
      }),
    ]);

  let avgFirstResponseMins: number | null = null;
  if (responded.length > 0) {
    const totalMins = responded.reduce((acc, r) => {
      const ms = r.firstResponseAt!.getTime() - r.createdAt.getTime();
      return acc + Math.max(0, ms) / 60000;
    }, 0);
    avgFirstResponseMins = Math.round(totalMins / responded.length);
  }

  return { openTotal, inProgress, critical, avgFirstResponseMins, resolvedToday };
}

function startOfTodayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
