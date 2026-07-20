import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, unscopedPrisma, __resetTenantResolution } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { eraseGuest, exportGuestData } from "@/lib/dpdp";
import { issueInvoice } from "@/lib/invoices";
import { hashPhone } from "@/lib/community/scam";

// GAP-8/US-202. The point of these tests is that erasure removes personal data
// EVERYWHERE without disturbing the financial and statutory record.

const TAG = `dpdp-${Date.now()}`;
const PHONE = `9${TAG.slice(-9)}`;
let propertyId: string, guestId: string, reservationId: string, roomTypeId: string, roomId: string, channelId: string;

beforeAll(async () => {
  __resetTenantResolution();
  const p = await unscopedPrisma.propertySettings.create({ data: { name: `${TAG} House`, invoicePrefix: "DP" } });
  propertyId = p.id;

  await withTenant(propertyId, async () => {
    const rt = await prisma.roomType.create({ data: { name: `${TAG}-t`, baseRate: 200_000, maxOccupancy: 2, rateFloor: 100_000, rateCeiling: 500_000 } });
    roomTypeId = rt.id;
    const [room, channel] = await Promise.all([
      prisma.room.create({ data: { roomTypeId: rt.id, label: `${TAG}-A` } }),
      prisma.channel.create({ data: { name: `${TAG}-ch`, commissionPct: 0, collectsPayment: false } }),
    ]);
    roomId = room.id; channelId = channel.id;

    // A guest carrying the full PII surface, including the C-Form block.
    const guest = await prisma.guest.create({
      data: {
        name: "Priya Sharma", phone: PHONE, email: "priya@example.com", notes: "Allergic to peanuts",
        idNumber: "AADHAAR-1234", address: "12 MG Road, Shillong", vehicleNumber: "ML05AB1234",
        emergencyContactName: "Raj Sharma", emergencyContactPhone: "9800000111",
        preferences: ["quiet room"], blocked: true, blockReason: "Damaged furniture",
        nationality: "British", passportNumber: "P123456", visaNumber: "V987",
        purposeOfVisit: "Tourism", portOfEntry: "Kolkata",
      },
    });
    guestId = guest.id;

    // Their booking, with free text and money that must survive.
    const r = await prisma.reservation.create({
      data: {
        roomId, guestId, channelId, checkIn: new Date("2030-02-10"), checkOut: new Date("2030-02-12"),
        grossAmount: 400_000, specialRequests: "Priya needs a ground-floor room, travelling with medication",
      },
    });
    reservationId = r.id;
    await prisma.payment.create({ data: { reservationId: r.id, amount: 200_000, mode: "cash", note: "Cash from Priya at check-in" } });
    await prisma.complaint.create({ data: { guestId, reservationId: r.id, description: "Priya reported a broken heater", category: "other" } });
    await prisma.outboundMessage.create({ data: { source: "system", channel: "whatsapp", to: PHONE, body: `Hi Priya, your booking is confirmed`, guestId, reservationId: r.id } });
    await prisma.inboundBooking.create({ data: { source: "agoda", rawText: `Guest: Priya Sharma\nPhone: ${PHONE}\nCard: 4111111111111111`, guestName: "Priya Sharma", guestPhone: PHONE, reservationId: r.id } });
    await prisma.flaggedNumber.create({ data: { phone: PHONE, reason: "Damaged furniture" } });

    // An issued invoice — statutorily retained, must survive erasure intact.
    await issueInvoice(r.id);
  });
});

afterAll(async () => {
  await unscopedPrisma.invoiceLine.deleteMany({ where: { propertyId } });
  await unscopedPrisma.invoice.deleteMany({ where: { propertyId } });
  await unscopedPrisma.inboundBooking.deleteMany({ where: { propertyId } });
  await unscopedPrisma.outboundMessage.deleteMany({ where: { propertyId } });
  await unscopedPrisma.complaint.deleteMany({ where: { propertyId } });
  await unscopedPrisma.payment.deleteMany({ where: { propertyId } });
  await unscopedPrisma.auditEvent.deleteMany({ where: { propertyId } });
  await unscopedPrisma.reservation.deleteMany({ where: { propertyId } });
  await unscopedPrisma.flaggedNumber.deleteMany({ where: { propertyId } });
  await unscopedPrisma.guest.deleteMany({ where: { id: guestId } });
  await unscopedPrisma.room.deleteMany({ where: { propertyId } });
  await unscopedPrisma.roomType.deleteMany({ where: { id: roomTypeId } });
  await unscopedPrisma.channel.deleteMany({ where: { id: channelId } });
  await unscopedPrisma.propertySettings.deleteMany({ where: { id: propertyId } });
  __resetTenantResolution();
  await prisma.$disconnect();
});

describe("export (right to access)", () => {
  it("returns the personal data plus an honest withheld/limitations manifest", async () => {
    const data = await withTenant(propertyId, () => exportGuestData(guestId));
    expect(data).not.toBeNull();
    expect(data!.personalDetails.name).toBe("Priya Sharma");
    expect(data!.bookings).toHaveLength(1);
    expect(data!.messages).toHaveLength(1);
    expect(data!.complaints).toHaveLength(1);
    expect(data!.blocklistEntries).toHaveLength(1);
    // The position on what is NOT erased is declared, not implicit.
    expect(data!.withheldFromErasure.join(" ")).toMatch(/invoice/i);
    expect(data!.limitations.join(" ")).toMatch(/conversation/i);
  });
});

describe("erasure (right to erasure)", () => {
  it("removes personal data from every table that held it", async () => {
    const before = await withTenant(propertyId, () => prisma.invoice.findFirst({ where: { reservationId } }));

    const result = await withTenant(propertyId, () => eraseGuest(guestId));
    expect(result?.ok).toBe(true);

    const g = await unscopedPrisma.guest.findUnique({ where: { id: guestId } });
    // Tier A — the guest record itself, including the C-Form block.
    expect(g!.name).toBe("Erased guest");
    expect(g!.phone).not.toBe(PHONE);
    expect(g!.email).toBeNull();
    expect(g!.notes).toBeNull();
    expect(g!.idNumber).toBeNull();
    expect(g!.address).toBeNull();
    expect(g!.vehicleNumber).toBeNull();
    expect(g!.emergencyContactName).toBeNull();
    expect(g!.emergencyContactPhone).toBeNull();
    expect(g!.preferences).toEqual([]);
    expect(g!.nationality).toBeNull();
    expect(g!.passportNumber).toBeNull();
    expect(g!.visaNumber).toBeNull();
    expect(g!.purposeOfVisit).toBeNull();
    expect(g!.portOfEntry).toBeNull();
    expect(g!.erasedAt).not.toBeNull();

    // Tier B — PII copied into other rows.
    const r = await unscopedPrisma.reservation.findUnique({ where: { id: reservationId } });
    expect(r!.specialRequests).toBeNull();
    const pay = await unscopedPrisma.payment.findFirst({ where: { reservationId } });
    expect(pay!.note).toBeNull();
    const c = await unscopedPrisma.complaint.findFirst({ where: { guestId } });
    expect(c!.description).toBe("[erased]");
    const msg = await unscopedPrisma.outboundMessage.findFirst({ where: { guestId } });
    expect(msg!.to).toBe("[erased]");
    expect(msg!.body).toBe("[erased]");
    // The raw OTA email — the densest PII blob — including the card number in it.
    const inb = await unscopedPrisma.inboundBooking.findFirst({ where: { reservationId } });
    expect(inb!.rawText).toBe("[erased]");
    expect(inb!.guestName).toBeNull();
    expect(inb!.guestPhone).toBeNull();

    // No table anywhere still contains the raw phone number.
    const stillHasPhone = await unscopedPrisma.$queryRawUnsafe<{ n: bigint }[]>(
      `select (select count(*) from guests where phone = $1)
            + (select count(*) from inbound_bookings where guest_phone = $1)
            + (select count(*) from outbound_messages where "to" = $1) as n`,
      PHONE,
    );
    expect(Number(stillHasPhone[0].n)).toBe(0);

    // Tier D — the financial + statutory record is untouched.
    expect(Number(r!.grossAmount)).toBe(400_000);
    expect(Number(pay!.amount)).toBe(200_000);
    const after = await unscopedPrisma.invoice.findFirst({ where: { reservationId } });
    expect(after!.number).toBe(before!.number);
    expect(Number(after!.totalPaise)).toBe(Number(before!.totalPaise));
    expect(after!.guestName).toBe("Priya Sharma"); // retained under statutory obligation
  });

  it("keeps the safety block working via a one-way hash", async () => {
    const flagged = await unscopedPrisma.flaggedNumber.findFirst({ where: { propertyId } });
    expect(flagged!.phone).not.toBe(PHONE); // no longer readable
    expect(flagged!.phone).toBe(hashPhone(PHONE)); // but still matches that number
    const g = await unscopedPrisma.guest.findUnique({ where: { id: guestId } });
    expect(g!.blocked).toBe(true);
  });

  it("is idempotent, and the phone tombstone is unique per guest", async () => {
    const again = await withTenant(propertyId, () => eraseGuest(guestId));
    expect(again?.ok).toBe(true);

    // A second guest erased in the same property must not collide on Guest.phone
    // (it is UNIQUE — a constant tombstone would throw here).
    const other = await withTenant(propertyId, () =>
      prisma.guest.create({ data: { name: "Other Guest", phone: `${PHONE}-2` } }),
    );
    const res = await withTenant(propertyId, () => eraseGuest(other.id));
    expect(res?.ok).toBe(true);
    const both = await unscopedPrisma.guest.findMany({ where: { id: { in: [guestId, other.id] } }, select: { phone: true } });
    expect(new Set(both.map((x) => x.phone)).size).toBe(2);
    await unscopedPrisma.guest.deleteMany({ where: { id: other.id } });
  });
});
