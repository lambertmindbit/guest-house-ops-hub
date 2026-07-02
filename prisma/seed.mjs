import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

// Mirrors src/lib/password.ts (scrypt$salt$hash). Inlined because the seed is
// plain .mjs and can't import the TS helper.
function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

// The 5 booking sources for Phase 1. Commission/collects_payment are sensible
// starting values the owner can adjust later; they don't drive any logic yet.
const CHANNELS = [
  { name: "Direct", commissionPct: 0, collectsPayment: false },
  { name: "WhatsApp", commissionPct: 0, collectsPayment: false },
  { name: "Booking.com", commissionPct: 15, collectsPayment: false },
  { name: "Agoda", commissionPct: 18, collectsPayment: true },
  { name: "MakeMyTrip", commissionPct: 18, collectsPayment: true },
  // Direct-ish sources the owner uses (Lawei): no commission, owner collects.
  { name: "Instagram", commissionPct: 0, collectsPayment: false },
  { name: "Facebook", commissionPct: 0, collectsPayment: false },
  { name: "Travel agent", commissionPct: 10, collectsPayment: false },
  { name: "Walk-in", commissionPct: 0, collectsPayment: false },
  { name: "Word-of-mouth", commissionPct: 0, collectsPayment: false },
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

// The single property (tenant root). Multi-tenancy scopes data by this id.
async function ensureProperty() {
  const existing = await prisma.propertySettings.findFirst();
  return existing ?? prisma.propertySettings.create({ data: { name: "My Guest House" } });
}

// findFirst-then-create keeps the seed idempotent without adding unique
// constraints the schema doesn't call for: re-running changes nothing.
async function ensureChannel(channel, propertyId) {
  const existing = await prisma.channel.findFirst({ where: { name: channel.name } });
  if (existing) return existing;
  return prisma.channel.create({ data: { ...channel, propertyId } });
}

async function ensureRoomType({ rooms, ...data }, propertyId) {
  let roomType = await prisma.roomType.findFirst({ where: { name: data.name } });
  if (!roomType) roomType = await prisma.roomType.create({ data: { ...data, propertyId } });
  for (const label of rooms) {
    const room = await prisma.room.findFirst({
      where: { label, roomTypeId: roomType.id },
    });
    if (!room) {
      await prisma.room.create({ data: { label, roomTypeId: roomType.id, propertyId } });
    }
  }
  return roomType;
}

// A SECOND demo property so the community network (Phase 3) is demonstrable.
// Opt-in via SEED_PEER=1 so single-property deployments never gain a phantom
// property. Idempotent by name. Login for the peer owner: the email below +
// SEED_PEER_PASSWORD (default "peer-demo-1234", demo only — change for real use).
async function seedPeerProperty(primaryPropertyId) {
  const name = "Orchid Homestay";
  const existing = await prisma.propertySettings.findFirst({ where: { name } });
  const property =
    existing ??
    (await prisma.propertySettings.create({
      data: {
        name,
        publicName: name,
        locality: "Laitkor, Shillong",
        bio: "Quiet 3-room homestay with parking and airport pickup.",
        isDiscoverable: true,
        priceBand: "budget",
      },
    }));

  const rt =
    (await prisma.roomType.findFirst({ where: { name: "Peer Standard", propertyId: property.id } })) ??
    (await prisma.roomType.create({
      data: { name: "Peer Standard", baseRate: 2000, maxOccupancy: 2, rateFloor: 1500, rateCeiling: 3500, propertyId: property.id },
    }));
  for (const label of ["A1", "A2", "A3"]) {
    const room = await prisma.room.findFirst({ where: { label, roomTypeId: rt.id } });
    if (!room) await prisma.room.create({ data: { label, roomTypeId: rt.id, propertyId: property.id } });
  }

  const email = "peer@demo.local";
  let peerUser = await prisma.user.findUnique({ where: { email } });
  if (!peerUser) {
    peerUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(process.env.SEED_PEER_PASSWORD ?? "peer-demo-1234"),
        role: "owner",
        propertyId: property.id,
      },
    });
  }

  // Let the peer owner switch into the primary property too (demos the multi-
  // location property switcher). Idempotent via the (user, property) unique.
  if (primaryPropertyId) {
    const existing = await prisma.userProperty.findFirst({ where: { userId: peerUser.id, propertyId: primaryPropertyId } });
    if (!existing) await prisma.userProperty.create({ data: { userId: peerUser.id, propertyId: primaryPropertyId } });
  }
  console.log(`Peer property ready: ${name} (${property.id}); login ${email}.`);
}

async function main() {
  // The seed uses the raw client (no tenant extension), so stamp propertyId itself.
  const property = await ensureProperty();
  for (const channel of CHANNELS) await ensureChannel(channel, property.id);
  for (const roomType of ROOM_TYPES) await ensureRoomType(roomType, property.id);

  const [channels, roomTypes, rooms] = await Promise.all([
    prisma.channel.count(),
    prisma.roomType.count(),
    prisma.room.count(),
  ]);
  console.log(`Seed complete: ${channels} channels, ${roomTypes} room types, ${rooms} rooms.`);

  if (process.env.SEED_PEER === "1") await seedPeerProperty(property.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
