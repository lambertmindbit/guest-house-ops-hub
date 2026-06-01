import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The 5 booking sources for Phase 1. Commission/collects_payment are sensible
// starting values the owner can adjust later; they don't drive any logic yet.
const CHANNELS = [
  { name: "Direct", commissionPct: 0, collectsPayment: false },
  { name: "WhatsApp", commissionPct: 0, collectsPayment: false },
  { name: "Booking.com", commissionPct: 15, collectsPayment: false },
  { name: "Agoda", commissionPct: 18, collectsPayment: true },
  { name: "MakeMyTrip", commissionPct: 18, collectsPayment: true },
];

// A small sample property: 3 room types, 6 physical rooms.
const ROOM_TYPES = [
  {
    name: "Standard Double",
    baseRate: 2500,
    maxOccupancy: 2,
    rateFloor: 1800,
    rateCeiling: 4000,
    rooms: ["101", "102", "103"],
  },
  {
    name: "Deluxe",
    baseRate: 3500,
    maxOccupancy: 3,
    rateFloor: 2500,
    rateCeiling: 6000,
    rooms: ["201", "202"],
  },
  {
    name: "Family Suite",
    baseRate: 5000,
    maxOccupancy: 4,
    rateFloor: 4000,
    rateCeiling: 9000,
    rooms: ["301"],
  },
];

// findFirst-then-create keeps the seed idempotent without adding unique
// constraints the schema doesn't call for: re-running changes nothing.
async function ensureChannel(channel) {
  const existing = await prisma.channel.findFirst({ where: { name: channel.name } });
  if (existing) return existing;
  return prisma.channel.create({ data: channel });
}

async function ensureRoomType({ rooms, ...data }) {
  let roomType = await prisma.roomType.findFirst({ where: { name: data.name } });
  if (!roomType) roomType = await prisma.roomType.create({ data });
  for (const label of rooms) {
    const room = await prisma.room.findFirst({
      where: { label, roomTypeId: roomType.id },
    });
    if (!room) {
      await prisma.room.create({ data: { label, roomTypeId: roomType.id } });
    }
  }
  return roomType;
}

async function main() {
  for (const channel of CHANNELS) await ensureChannel(channel);
  for (const roomType of ROOM_TYPES) await ensureRoomType(roomType);

  const [channels, roomTypes, rooms] = await Promise.all([
    prisma.channel.count(),
    prisma.roomType.count(),
    prisma.room.count(),
  ]);
  console.log(`Seed complete: ${channels} channels, ${roomTypes} room types, ${rooms} rooms.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
