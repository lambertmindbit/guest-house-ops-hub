import { prisma } from "@/lib/prisma";

// Multi-location support: the properties a user may act as. Their primary
// property (User.propertyId, in the session) is always included; UserProperty
// rows grant access to additional ones.

export type UserPropertyOption = { id: string; name: string };

export async function listUserProperties(userId: string, primaryPropertyId: string | null): Promise<UserPropertyOption[]> {
  const memberships = await prisma.userProperty.findMany({ where: { userId }, select: { propertyId: true } });
  const ids = new Set(memberships.map((m) => m.propertyId));
  if (primaryPropertyId) ids.add(primaryPropertyId);
  if (ids.size === 0) return [];
  const props = await prisma.propertySettings.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, publicName: true },
    orderBy: { name: "asc" },
  });
  return props.map((p) => ({ id: p.id, name: p.publicName || p.name }));
}

export async function userCanAccessProperty(userId: string, primaryPropertyId: string | null, targetPropertyId: string): Promise<boolean> {
  if (targetPropertyId === primaryPropertyId) return true;
  const membership = await prisma.userProperty.findFirst({ where: { userId, propertyId: targetPropertyId }, select: { id: true } });
  return !!membership;
}
