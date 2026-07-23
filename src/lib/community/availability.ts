import { unscopedPrisma } from "@/lib/prisma";
import { getAvailability } from "@/lib/availability";
import { assertCanRead } from "@/lib/community/network";

// Opt-in, permissioned, DERIVED peer availability. Requires an AVAILABILITY grant
// from the peer (owner) to the viewer. Returns ONLY room counts — never guest,
// rate or finance data. Availability is computed live from the peer's
// reservations + blocks (reusing src/lib/availability.ts) and never stored.

export type PeerRoomTypeAvailability = {
  roomTypeId: string;
  roomTypeName: string;
  maxOccupancy: number;
  total: number;
  // Fewest units free on any single night in [from, to) — a conservative
  // "rooms free for these dates" signal derived from per-night availability.
  minAvailable: number;
};

export async function peerAvailability(
  peerPropertyId: string,
  viewerPropertyId: string,
  from: string,
  to: string,
): Promise<PeerRoomTypeAvailability[]> {
  // Throws unless the peer has an accepted connection + an enabled availability
  // grant to the viewer. This is the cross-tenant gate.
  await assertCanRead(peerPropertyId, viewerPropertyId, "availability");

  const roomTypes = await unscopedPrisma.roomType.findMany({
    where: { propertyId: peerPropertyId },
    select: { id: true, name: true, maxOccupancy: true },
    orderBy: { name: "asc" },
  });

  const out: PeerRoomTypeAvailability[] = [];
  for (const rt of roomTypes) {
    // getAvailability is raw SQL keyed on roomTypeId (not tenant-intercepted), so
    // passing the peer's room-type id computes the peer's availability correctly.
    const nights = await getAvailability(rt.id, from, to);
    const total = nights[0]?.total ?? 0;
    // Advertise the BOOKABLE count (net of the oversell buffer, GAP-24): the regional
    // network is external, so peers shouldn't be able to commit the safety margin.
    const minAvailable = nights.length ? Math.min(...nights.map((n) => n.bookable)) : total;
    out.push({ roomTypeId: rt.id, roomTypeName: rt.name, maxOccupancy: rt.maxOccupancy, total, minAvailable });
  }
  return out;
}
