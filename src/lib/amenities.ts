import { prisma } from "@/lib/prisma";

export async function listAmenities() {
  return prisma.amenity.findMany({ orderBy: { name: "asc" } });
}
export async function createAmenity(name: string) {
  return prisma.amenity.create({ data: { name } });
}
export async function deleteAmenity(id: string) {
  return prisma.amenity.delete({ where: { id } });
}

export async function listRoomTypeAmenities() {
  return prisma.roomTypeAmenity.findMany({ select: { roomTypeId: true, amenityId: true } });
}
// Toggle one amenity on a room type (idempotent).
export async function setRoomTypeAmenity(roomTypeId: string, amenityId: string, on: boolean) {
  const existing = await prisma.roomTypeAmenity.findFirst({ where: { roomTypeId, amenityId } });
  if (on && !existing) return prisma.roomTypeAmenity.create({ data: { roomTypeId, amenityId } });
  if (!on && existing) return prisma.roomTypeAmenity.delete({ where: { id: existing.id } });
  return existing;
}

// Pure: which amenity ids each room type has (serializable arrays).
export function amenityIdsByRoomType(links: { roomTypeId: string; amenityId: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of links) (out[l.roomTypeId] ??= []).push(l.amenityId);
  return out;
}
