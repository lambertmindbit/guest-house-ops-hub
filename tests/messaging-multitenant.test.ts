import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, prismaForTenant, __resetTenantResolution } from "@/lib/prisma";
import { runMessagingTriggers, setMessageAdapter, LogAdapter } from "@/lib/messaging";
import { todayDateOnly, addDays, parseDateOnly } from "@/lib/dates";

// M-4: the daily cron must process EVERY property, not just the sole one, and
// stamp each message with the correct property.
const TAG = `msgmt-${Date.now()}`;
const props: string[] = [];
const reservationIds: string[] = [];

async function seedPropertyWithArrival(name: string): Promise<{ propertyId: string; reservationId: string }> {
  const propertyId = (await prisma.propertySettings.create({ data: { name } })).id;
  const db = prismaForTenant(propertyId);
  const rt = await db.roomType.create({ data: { name: `${name}-t`, baseRate: 4000, maxOccupancy: 2, rateFloor: 1000, rateCeiling: 8000 } });
  const room = await db.room.create({ data: { roomTypeId: rt.id, label: `${name}-1` } });
  const guest = await db.guest.create({ data: { name: `${name}-g`, phone: `${name}-phone` } });
  const channel = await db.channel.create({ data: { name: `${name}-c`, commissionPct: 0, collectsPayment: false } });
  const today = todayDateOnly();
  const reservationId = (await db.reservation.create({
    data: { roomId: room.id, guestId: guest.id, channelId: channel.id, checkIn: parseDateOnly(addDays(today, 1)), checkOut: parseDateOnly(addDays(today, 2)), grossAmount: 4000 },
  })).id;
  return { propertyId, reservationId };
}

beforeAll(async () => {
  __resetTenantResolution();
  for (const suffix of ["A", "B"]) {
    const { propertyId, reservationId } = await seedPropertyWithArrival(`${TAG}-${suffix}`);
    props.push(propertyId);
    reservationIds.push(reservationId);
  }
});

afterAll(async () => {
  setMessageAdapter(LogAdapter);
  await prisma.outboundMessage.deleteMany({ where: { reservationId: { in: reservationIds } } });
  for (const p of props) {
    await prisma.reservation.deleteMany({ where: { propertyId: p } });
    await prisma.guest.deleteMany({ where: { propertyId: p } });
    await prisma.channel.deleteMany({ where: { propertyId: p } });
    await prisma.room.deleteMany({ where: { propertyId: p } });
    await prisma.roomType.deleteMany({ where: { propertyId: p } });
  }
  await prisma.propertySettings.deleteMany({ where: { id: { in: props } } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("runMessagingTriggers across properties (M-4)", () => {
  it("messages tomorrow's arrival in BOTH properties, each stamped to its own property", async () => {
    await runMessagingTriggers();

    for (let i = 0; i < props.length; i++) {
      const msg = await prisma.outboundMessage.findFirst({
        where: { reservationId: reservationIds[i], template: "preArrivalDirections" },
        select: { propertyId: true },
      });
      expect(msg, `property ${props[i]} arrival should be messaged`).not.toBeNull();
      expect(msg?.propertyId).toBe(props[i]); // stamped to the right property
    }
  });
});
