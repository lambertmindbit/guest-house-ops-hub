import { prisma, unscopedPrisma } from "@/lib/prisma";
import type { ShareType } from "@prisma/client";

// Shared trusted directories (Phase 3, slice h). Read-only sharing of a peer's
// vendor + driver contacts within the trusted network, gated by the VENDORS /
// TRANSPORT grants. Only the public contact fields are projected — never private
// notes, ratings-with-context, purchase orders, payments, trips or fares.
// Guides + emergency contacts are just vendors with those categories.

export type SharedVendor = { id: string; name: string; category: string | null; contact: string | null; rating: number | null; ownerName: string };
export type SharedDriver = { id: string; name: string; phone: string | null; vehicleNumber: string | null; ownerName: string };

// Property ids that share `type` with the viewer.
async function sharersFor(viewerPropertyId: string, type: ShareType): Promise<string[]> {
  const grants = await prisma.sharingGrant.findMany({
    where: { granteePropertyId: viewerPropertyId, dataType: type, enabled: true },
    select: { grantorPropertyId: true },
  });
  return grants.map((g) => g.grantorPropertyId);
}

async function nameMap(propertyIds: string[]): Promise<Map<string, string>> {
  const profiles = await prisma.propertySettings.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true, publicName: true } });
  return new Map(profiles.map((p) => [p.id, p.publicName || p.name]));
}

export async function sharedVendors(viewerPropertyId: string): Promise<SharedVendor[]> {
  const sharerIds = await sharersFor(viewerPropertyId, "vendors");
  if (sharerIds.length === 0) return [];
  const rows = await unscopedPrisma.vendor.findMany({
    where: { propertyId: { in: sharerIds } },
    select: { id: true, name: true, category: true, contact: true, rating: true, propertyId: true },
    orderBy: { name: "asc" },
  });
  const names = await nameMap(sharerIds);
  return rows.map((v) => ({ id: v.id, name: v.name, category: v.category, contact: v.contact, rating: v.rating, ownerName: names.get(v.propertyId ?? "") ?? "A peer" }));
}

export async function sharedDrivers(viewerPropertyId: string): Promise<SharedDriver[]> {
  const sharerIds = await sharersFor(viewerPropertyId, "transport");
  if (sharerIds.length === 0) return [];
  const rows = await unscopedPrisma.driver.findMany({
    where: { propertyId: { in: sharerIds }, active: true },
    select: { id: true, name: true, phone: true, vehicleNumber: true, propertyId: true },
    orderBy: { name: "asc" },
  });
  const names = await nameMap(sharerIds);
  return rows.map((d) => ({ id: d.id, name: d.name, phone: d.phone, vehicleNumber: d.vehicleNumber, ownerName: names.get(d.propertyId ?? "") ?? "A peer" }));
}
