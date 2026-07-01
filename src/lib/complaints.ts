import { prisma } from "@/lib/prisma";
import type { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "@prisma/client";
import { createEscalation } from "@/lib/escalations";

export type CreateComplaintInput = {
  description: string;
  category?: ComplaintCategory;
  priority?: ComplaintPriority;
  assignee?: string | null;
  guestId?: string | null;
  reservationId?: string | null;
};

// maintenance complaints route to the maintenance escalation bucket; everything
// else is guest-facing (customer).
function escalationCategory(c: ComplaintCategory) {
  return c === "maintenance" ? ("maintenance" as const) : ("customer" as const);
}

export async function createComplaint(input: CreateComplaintInput) {
  const priority = input.priority ?? "medium";
  let escalationId: string | null = null;

  // Urgent (high) complaints also file into the shared HITL queue so they show
  // up on /needs-you — the owner shouldn't have to watch two lists for urgent work.
  if (priority === "high") {
    const { escalation } = await createEscalation({
      source: "manual",
      category: escalationCategory(input.category ?? "other"),
      severity: "high",
      title: `Complaint: ${input.category ?? "other"}`,
      summary: input.description.trim(),
      relatedType: input.reservationId ? "reservation" : input.guestId ? "guest" : "none",
      relatedId: input.reservationId ?? input.guestId ?? null,
    });
    escalationId = escalation.id;
  }

  return prisma.complaint.create({
    data: {
      description: input.description.trim(),
      category: input.category ?? "other",
      priority,
      assignee: input.assignee ?? null,
      guestId: input.guestId ?? null,
      reservationId: input.reservationId ?? null,
      escalationId,
    },
  });
}

export type TransitionComplaintInput = {
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  assignee?: string | null;
  resolutionNote?: string | null;
  satisfaction?: number | null;
};

export async function transitionComplaint(id: string, patch: TransitionComplaintInput) {
  const current = await prisma.complaint.findUnique({ where: { id } });
  if (!current) return null;
  const data: Record<string, unknown> = { ...patch };
  // Stamp resolvedAt when it reaches resolved; clear it if reopened.
  if (patch.status !== undefined && patch.status !== current.status) {
    data.resolvedAt = patch.status === "resolved" ? new Date() : null;
  }
  return prisma.complaint.update({ where: { id }, data });
}

export async function listComplaints(
  filters: { status?: ComplaintStatus; category?: ComplaintCategory } = {},
) {
  return prisma.complaint.findMany({
    where: { status: filters.status, category: filters.category },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: { guest: { select: { id: true, name: true } } },
    take: 500,
  });
}

export async function getComplaint(id: string) {
  return prisma.complaint.findUnique({
    where: { id },
    include: {
      guest: { select: { id: true, name: true } },
      reservation: { select: { id: true, checkIn: true } },
    },
  });
}

// ── Report ────────────────────────────────────────────────────────────────
export type ComplaintRowForReport = { category: string; status: string; createdAt: string; resolvedAt: string | null };
export type ComplaintReport = {
  total: number;
  openTotal: number;
  byCategory: { category: string; count: number }[];
  avgResolutionHours: number | null;
};

// Pure — testable without a DB. Volume by category + mean resolution time.
export function summarizeComplaints(rows: ComplaintRowForReport[]): ComplaintReport {
  const total = rows.length;
  const openTotal = rows.filter((r) => r.status !== "resolved").length;

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const byCategory = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const resolved = rows.filter((r) => r.status === "resolved" && r.resolvedAt);
  let avgResolutionHours: number | null = null;
  if (resolved.length > 0) {
    const totalH = resolved.reduce(
      (acc, r) => acc + Math.max(0, (Date.parse(r.resolvedAt!) - Date.parse(r.createdAt)) / 3_600_000),
      0,
    );
    avgResolutionHours = Math.round((totalH / resolved.length) * 10) / 10;
  }
  return { total, openTotal, byCategory, avgResolutionHours };
}

export async function complaintReport(): Promise<ComplaintReport> {
  const rows = await prisma.complaint.findMany({
    select: { category: true, status: true, createdAt: true, resolvedAt: true },
  });
  return summarizeComplaints(
    rows.map((r) => ({
      category: r.category,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    })),
  );
}
