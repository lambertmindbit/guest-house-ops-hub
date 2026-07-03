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

// Sample team so the Staff screen (directory, roster, attendance) has data to
// test with — mirrors Lawei's real mix (reception, housekeeping, cook, delivery).
const STAFF = [
  { name: "Ibalari Kharkongor", role: "Reception", phone: "9863000001" },
  { name: "Wanda Syiem", role: "Housekeeping", phone: "9863000002" },
  { name: "Balen Marak", role: "Cook", phone: "9863000003" },
  { name: "Deiwis Marbaniang", role: "Housekeeping", phone: "9863000004" },
  { name: "Rilang Nongrum", role: "Delivery", phone: "9863000005" },
  { name: "Phrangsngi Lyngdoh", role: "Reception", phone: "9863000006" },
];

async function ensureStaff(staff, propertyId) {
  const existing = await prisma.staff.findFirst({ where: { name: staff.name, propertyId } });
  return existing ?? prisma.staff.create({ data: { ...staff, propertyId } });
}

async function seedStaff(propertyId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const created = [];
  for (const s of STAFF) created.push(await ensureStaff(s, propertyId));

  // A few shifts today (idempotent by staff+date).
  const shifts = [
    [0, "07:00", "15:00"], // reception — morning
    [5, "15:00", "23:00"], // reception — evening
    [1, "08:00", "16:00"], // housekeeping
    [3, "08:00", "16:00"], // housekeeping
    [2, "06:00", "14:00"], // cook
  ];
  for (const [i, start, end] of shifts) {
    const staff = created[i];
    const existing = await prisma.shift.findFirst({ where: { staffId: staff.id, date: today } });
    if (!existing) await prisma.shift.create({ data: { staffId: staff.id, date: today, start, end, propertyId } });
  }

  // Today's attendance (unique per staff+date).
  const attendance = [[0, "present"], [1, "present"], [2, "present"], [3, "leave"], [4, "absent"], [5, "present"]];
  for (const [i, status] of attendance) {
    const staff = created[i];
    const existing = await prisma.attendance.findFirst({ where: { staffId: staff.id, date: today } });
    if (!existing) await prisma.attendance.create({ data: { staffId: staff.id, date: today, status, propertyId } });
  }
  console.log(`Staff ready: ${created.length} staff, ${shifts.length} shifts + today's attendance.`);
}

// Sample data for the Facilities modules so each screen has something to test.
const VENDORS = [
  { name: "Shillong Laundry Co.", category: "Laundry", contact: "9863100001", rating: 4 },
  { name: "Mawlai Groceries", category: "Groceries", contact: "9863100002", rating: 5 },
  { name: "Bara Bazar Provisions", category: "Groceries", contact: "9863100003", rating: 3 },
  { name: "Khasi Restaurant Supply", category: "Restaurant", contact: "9863100004", rating: 4 },
];
const INVENTORY = [
  { name: "Toilet paper", unit: "rolls", quantity: 48, minThreshold: 24 },
  { name: "Shampoo sachets", unit: "pcs", quantity: 30, minThreshold: 40 }, // low stock
  { name: "Tea (packets)", unit: "packets", quantity: 12, minThreshold: 10 },
  { name: "LPG cylinder", unit: "pcs", quantity: 2, minThreshold: 2 }, // low stock
  { name: "Bed linen sets", unit: "sets", quantity: 18, minThreshold: 12 },
];
const ASSETS = [
  { name: "Geyser — Room 101", category: "Water heater", preventiveEveryDays: 180 },
  { name: "Generator", category: "Power", preventiveEveryDays: 90 },
  { name: "Water pump", category: "Plumbing", preventiveEveryDays: 120 },
];
const MAINT = [
  { title: "Geyser not heating in 101", priority: "high", status: "open" },
  { title: "Wi-Fi router keeps dropping in lobby", priority: "medium", status: "in_progress" },
  { title: "Leaky tap — Room 202", priority: "low", status: "open" },
];
const TOUR_PARTNERS = [
  { name: "David Kharkongor (guide)", contact: "9863200001", commissionPct: 15 },
  { name: "Meghalaya Trails", contact: "9863200002", commissionPct: 10 },
];
const TOURS = [
  { name: "Living-root bridge trek", price: 1800, partner: "David Kharkongor (guide)" },
  { name: "Shillong city sightseeing", price: 1200, partner: "Meghalaya Trails" },
  { name: "Mawlynnong village day trip", price: 2500, partner: null },
];
// One sample tour booking linked to a guest, so the Tours "Bookings" list isn't
// empty and shows the guest ↔ tour link. Creates a clearly-sample guest for it.
const TOUR_BOOKING = { guestName: "Sample Guest (tours)", guestPhone: "9800000001", tour: "Living-root bridge trek", amount: 1800, status: "confirmed", note: "Sample booking", daysAhead: 2 };

// Transport: drivers + a few trips (mix of done/planned, some with fares) so the
// Transport screen and its fare roll-up have something to show.
const DRIVERS = [
  { name: "Bah Kyrmen", phone: "9863500001", vehicleNumber: "ML05 A 1234" },
  { name: "Deiwan Taxi Service", phone: "9863500002", vehicleNumber: "ML05 B 5678" },
  { name: "Airport Cabs Shillong", phone: "9863500003", vehicleNumber: "ML05 C 9012" },
];
const TRIPS = [
  { driver: "Bah Kyrmen", pickup: "Umroi Airport", dropoff: "Guest House", status: "done", fare: 900, dayOffset: -1, note: "Airport pickup" },
  { driver: "Deiwan Taxi Service", pickup: "Guest House", dropoff: "Police Bazar", status: "done", fare: 250, dayOffset: -2, note: null },
  { driver: "Airport Cabs Shillong", pickup: "Guest House", dropoff: "Cherrapunji day trip", status: "planned", fare: 2500, dayOffset: 1, note: "Full-day sightseeing" },
  { driver: null, pickup: "Guest House", dropoff: "Shillong Bus Stand", status: "planned", fare: 400, dayOffset: 0, note: "Driver TBD" },
];

// Owner-managed contact list + a few referrals sent out, so the Partners and
// Referrals screens have something to test.
const PARTNERS = [
  { name: "Pinewood Homestay", kind: "homestay", phone: "9863300001", locality: "Laitumkhrah", rating: 4, notes: "Takes overflow on weekends" },
  { name: "Hotel Polo Orchid", kind: "hotel", phone: "9863300002", locality: "Police Bazar", rating: 5, notes: null },
  { name: "Bah Rikynti (taxi)", kind: "driver", phone: "9863300003", locality: "Shillong", rating: 4, notes: "Airport & Cherrapunji runs" },
  { name: "Meghalaya Holidays", kind: "agent", phone: "9863300004", locality: "Police Bazar", rating: 3, notes: "Sends group bookings" },
];
const REFERRALS = [
  { guest: "Rohan Mehta", partner: "Pinewood Homestay", status: "booked", note: "We were full; sent for 2 nights" },
  { guest: "The Iyer family", partner: "Hotel Polo Orchid", status: "referred", note: "Wanted 3 rooms" },
  { guest: "Anita Rao", partner: "Meghalaya Holidays", status: "declined", note: "Preferred to book elsewhere" },
];

async function ensureBy(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  return existing ?? prisma[model].create({ data });
}

async function seedPartners(propertyId) {
  for (const p of PARTNERS) await ensureBy("partner", { name: p.name, propertyId }, { ...p, propertyId });
  for (const r of REFERRALS) {
    const partner = r.partner ? await prisma.partner.findFirst({ where: { name: r.partner, propertyId } }) : null;
    await ensureBy(
      "outboundReferral",
      { guestName: r.guest, propertyId },
      { guestName: r.guest, partnerId: partner?.id ?? null, status: r.status, note: r.note, propertyId },
    );
  }
}

async function seedVendors(propertyId) {
  for (const v of VENDORS) await ensureBy("vendor", { name: v.name, propertyId }, { ...v, propertyId });
}
async function seedTransport(propertyId) {
  for (const d of DRIVERS) await ensureBy("driver", { name: d.name, propertyId }, { ...d, propertyId });
  for (const t of TRIPS) {
    const driver = t.driver ? await prisma.driver.findFirst({ where: { name: t.driver, propertyId } }) : null;
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + t.dayOffset);
    await ensureBy(
      "trip",
      { pickup: t.pickup, dropoff: t.dropoff, propertyId },
      { driverId: driver?.id ?? null, pickup: t.pickup, dropoff: t.dropoff, scheduledAt, status: t.status, fare: t.fare ?? null, note: t.note ?? null, propertyId },
    );
  }
}
async function seedInventory(propertyId) {
  for (const i of INVENTORY) await ensureBy("inventoryItem", { name: i.name, propertyId }, { ...i, propertyId });
}
async function seedMaintenance(propertyId) {
  for (const a of ASSETS) await ensureBy("asset", { name: a.name, propertyId }, { ...a, propertyId });
  for (const m of MAINT) await ensureBy("maintenanceRequest", { title: m.title, propertyId }, { ...m, propertyId });
}
async function seedTours(propertyId) {
  for (const p of TOUR_PARTNERS) await ensureBy("tourPartner", { name: p.name, propertyId }, { ...p, propertyId });
  for (const t of TOURS) {
    const partner = t.partner ? await prisma.tourPartner.findFirst({ where: { name: t.partner, propertyId } }) : null;
    await ensureBy("tour", { name: t.name, propertyId }, { name: t.name, price: t.price, partnerId: partner?.id ?? null, propertyId });
  }

  // A sample booking linked to a guest, so Tours → Bookings shows the guest link.
  const b = TOUR_BOOKING;
  const guest = await ensureBy("guest", { name: b.guestName, propertyId }, { name: b.guestName, phone: b.guestPhone, propertyId });
  const tour = await prisma.tour.findFirst({ where: { name: b.tour, propertyId } });
  if (tour) {
    const tourPartner = tour.partnerId ? await prisma.tourPartner.findUnique({ where: { id: tour.partnerId } }) : null;
    const date = new Date();
    date.setDate(date.getDate() + b.daysAhead);
    await ensureBy(
      "tourBooking",
      { note: b.note, propertyId },
      { tourId: tour.id, guestId: guest.id, partnerId: tour.partnerId ?? null, amount: b.amount, commissionPct: tourPartner?.commissionPct ?? null, status: b.status, date, note: b.note, propertyId },
    );
  }
}

async function main() {
  // The seed uses the raw client (no tenant extension), so stamp propertyId itself.
  const property = await ensureProperty();
  // SEED_MODULES=1 tops up only the team/facilities sample data (skips the sample
  // rooms/channels) — used to add test data to an existing/real property.
  if (process.env.SEED_MODULES !== "1") {
    for (const channel of CHANNELS) await ensureChannel(channel, property.id);
    for (const roomType of ROOM_TYPES) await ensureRoomType(roomType, property.id);
  }
  await seedStaff(property.id);
  await seedVendors(property.id);
  await seedInventory(property.id);
  await seedMaintenance(property.id);
  await seedTours(property.id);
  await seedTransport(property.id);
  await seedPartners(property.id);

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
