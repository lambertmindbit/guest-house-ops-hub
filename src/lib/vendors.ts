import { prisma } from "@/lib/prisma";
import type { PoStatus, PaymentMode } from "@prisma/client";

// ── Vendors ──────────────────────────────────────────────────────────────
export async function listVendors() {
  return prisma.vendor.findMany({ orderBy: { name: "asc" } });
}
export async function createVendor(data: { name: string; category?: string | null; contact?: string | null; rating?: number | null }) {
  return prisma.vendor.create({ data: { name: data.name, category: data.category ?? null, contact: data.contact ?? null, rating: data.rating ?? null } });
}

// ── Purchase orders ──────────────────────────────────────────────────────
export async function listPurchaseOrders() {
  return prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, include: { vendor: { select: { name: true } } } });
}
export async function createPO(data: { vendorId: string; description: string; amount: number; status?: PoStatus }) {
  return prisma.purchaseOrder.create({ data: { vendorId: data.vendorId, description: data.description, amount: data.amount, status: data.status ?? "draft" } });
}
export async function transitionPO(id: string, status: PoStatus) {
  const current = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.purchaseOrder.update({ where: { id }, data: { status, receivedAt: status === "received" ? new Date() : null } });
}

// ── Payments ─────────────────────────────────────────────────────────────
export async function listVendorPayments() {
  return prisma.vendorPayment.findMany({ orderBy: { paidAt: "desc" }, include: { vendor: { select: { name: true } } } });
}
export async function createVendorPayment(data: { vendorId: string; amount: number; mode?: PaymentMode | null; note?: string | null }) {
  return prisma.vendorPayment.create({ data: { vendorId: data.vendorId, amount: data.amount, mode: data.mode ?? null, note: data.note ?? null } });
}

// ── Pure procurement summary (testable) ──────────────────────────────────────
export type PoForSummary = { amount: number; status: PoStatus };
export function procurementSummary(
  pos: PoForSummary[],
  payments: { amount: number }[],
): { ordered: number; received: number; paid: number; outstanding: number } {
  let ordered = 0;
  let received = 0;
  for (const p of pos) {
    if (p.status !== "draft") ordered += p.amount;
    if (p.status === "received") received += p.amount;
  }
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  // You owe for goods received but not yet paid.
  return { ordered, received, paid, outstanding: Math.max(0, received - paid) };
}
