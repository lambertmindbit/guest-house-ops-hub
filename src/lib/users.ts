import { prisma } from "@/lib/prisma";

// Would removing owner-ness from this user leave the property with zero active
// owners? Guards the users route against demoting/disabling/deleting the last
// owner and locking everyone out of Finance/Settings/Users.
export async function isLastActiveOwner(userId: string): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (target?.role !== "owner" || !target.active) return false;
  const otherOwners = await prisma.user.count({ where: { role: "owner", active: true, id: { not: userId } } });
  return otherOwners === 0;
}
