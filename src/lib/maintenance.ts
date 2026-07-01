import { prisma } from "@/lib/prisma";
import type { MaintenanceStatus, MaintenancePriority } from "@prisma/client";
import { parseDateOnly, todayDateOnly, addDays } from "@/lib/dates";

// ── Assets ───────────────────────────────────────────────────────────────
export async function listAssets() {
  return prisma.asset.findMany({ orderBy: { name: "asc" } });
}
export async function createAsset(data: { name: string; category?: string | null; roomId?: string | null; preventiveEveryDays?: number | null }) {
  return prisma.asset.create({ data: { name: data.name, category: data.category ?? null, roomId: data.roomId ?? null, preventiveEveryDays: data.preventiveEveryDays ?? null } });
}
export async function serviceAsset(id: string) {
  return prisma.asset.update({ where: { id }, data: { lastServicedAt: parseDateOnly(todayDateOnly()) } });
}

// Pure: assets whose preventive service is due on/before `today`. An asset with a
// schedule but no service yet is due immediately.
export type AssetForDue = { id: string; name: string; preventiveEveryDays: number | null; lastServicedAt: string | null };
export function preventiveDue(assets: AssetForDue[], today: string): AssetForDue[] {
  return assets.filter((a) => {
    if (!a.preventiveEveryDays || a.preventiveEveryDays <= 0) return false;
    if (!a.lastServicedAt) return true;
    const due = addDays(a.lastServicedAt, a.preventiveEveryDays);
    return due <= today;
  });
}

// ── Requests ─────────────────────────────────────────────────────────────
export async function listRequests(status?: MaintenanceStatus) {
  return prisma.maintenanceRequest.findMany({
    where: { status },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });
}
export async function createRequest(data: {
  title: string; description?: string | null; assetId?: string | null; roomId?: string | null;
  priority?: MaintenancePriority; assigneeStaffId?: string | null; cost?: number | null;
}) {
  return prisma.maintenanceRequest.create({
    data: {
      title: data.title, description: data.description ?? null, assetId: data.assetId ?? null, roomId: data.roomId ?? null,
      priority: data.priority ?? "medium", assigneeStaffId: data.assigneeStaffId ?? null, cost: data.cost ?? null,
    },
  });
}
export async function transitionRequest(id: string, patch: {
  status?: MaintenanceStatus; priority?: MaintenancePriority; assigneeStaffId?: string | null; cost?: number | null; note?: string | null;
}) {
  const current = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!current) return null;
  const data: Record<string, unknown> = { ...patch };
  if (patch.status !== undefined && patch.status !== current.status) {
    data.resolvedAt = patch.status === "done" ? new Date() : null;
  }
  return prisma.maintenanceRequest.update({ where: { id }, data });
}
