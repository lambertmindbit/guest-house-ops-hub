import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { peerAvailability } from "@/lib/community/availability";
import { setGrant } from "@/lib/community/network";

// A peer shares availability with a viewer only after an accepted connection +
// an enabled availability grant. The result is DERIVED and carries counts only.

const TAG = `cavail-${Date.now()}`;
const FROM = "2026-09-20";
const TO = "2026-09-22"; // nights 20, 21

let peer: string;
let viewer: string;
let roomTypeId: string;
let roomId: string;
let guestId: string;
let channelId: string;

beforeAll(async () => {
  __resetTenantResolution();
  peer = (await prisma.propertySettings.create({ data: { name: `${TAG}-peer` } })).id;
  viewer = (await prisma.propertySettings.create({ data: { name: `${TAG}-viewer` } })).id;

  const pdb = prismaForTenant(peer);
  const rt = await pdb.roomType.create({ data: { name: `${TAG}-t`, baseRate: 1000, maxOccupancy: 2, rateFloor: 500, rateCeiling: 3000 } });
  roomTypeId = rt.id;
  roomId = (await pdb.room.create({ data: { roomTypeId, label: `${TAG}-101` } })).id;
  guestId = (await pdb.guest.create({ data: { name: `${TAG}-g`, phone: TAG } })).id;
  channelId = (await pdb.channel.create({ data: { name: `${TAG}-c`, commissionPct: 0, collectsPayment: false } })).id;

  // Accepted connection viewer↔peer.
  await prisma.networkConnection.create({ data: { requesterPropertyId: viewer, addresseePropertyId: peer, status: "accepted" } });
});

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { roomId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await prisma.sharingGrant.deleteMany({ where: { grantorPropertyId: peer } });
  await prisma.networkConnection.deleteMany({ where: { requesterPropertyId: viewer } });
  await prisma.propertySettings.deleteMany({ where: { id: { in: [peer, viewer] } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("peerAvailability", () => {
  it("throws until the peer shares availability with the viewer", async () => {
    await expect(peerAvailability(peer, viewer, FROM, TO)).rejects.toThrow();
    await setGrant(peer, viewer, "availability", true);
    await expect(peerAvailability(peer, viewer, FROM, TO)).resolves.toBeTruthy();
  });

  it("returns derived counts only (no guest/finance fields)", async () => {
    const rows = await peerAvailability(peer, viewer, FROM, TO);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ roomTypeId, roomTypeName: `${TAG}-t`, maxOccupancy: 2, total: 1, minAvailable: 1 });
    expect(Object.keys(rows[0]).sort()).toEqual(["maxOccupancy", "minAvailable", "roomTypeId", "roomTypeName", "total"]);
  });

  it("reflects a confirmed reservation (derived, not stored)", async () => {
    await prismaForTenant(peer).reservation.create({
      data: { roomId, guestId, channelId, checkIn: new Date(FROM), checkOut: new Date(TO) },
    });
    const rows = await peerAvailability(peer, viewer, FROM, TO);
    expect(rows[0].minAvailable).toBe(0); // occupied both nights
  });
});
