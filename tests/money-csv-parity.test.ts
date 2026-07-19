import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as reservationsCsv } from "@/app/api/export/reservations.csv/route";
import { GET as paymentsCsv } from "@/app/api/export/payments.csv/route";

// GAP-9/US-401 acceptance: money is now integer paise internally, but every visible
// rupee value must be UNCHANGED. The accountant CSVs are the contract. We seed a
// booking whose paise values represent ₹2,500 gross with ₹1,000 collected, and
// assert the CSV emits the same whole-rupee figures the pre-migration system did
// (2500 / 1000 / 1500), never the raw paise (250000 / 100000 / 150000).

const STAMP = Date.now();
let roomId: string, guestId: string, channelId: string, resId: string;

beforeAll(async () => {
  const rt = await prisma.roomType.create({ data: { name: `csv-${STAMP}-t`, baseRate: 250_000, maxOccupancy: 2, rateFloor: 50_000, rateCeiling: 600_000 } });
  const [room, guest, channel] = await Promise.all([
    prisma.room.create({ data: { roomTypeId: rt.id, label: `csv-${STAMP}-A` } }),
    prisma.guest.create({ data: { name: `CsvGuest${STAMP}`, phone: `csv-${STAMP}` } }),
    prisma.channel.create({ data: { name: `csv-${STAMP}-c`, commissionPct: 0, collectsPayment: false } }),
  ]);
  roomId = room.id; guestId = guest.id; channelId = channel.id;
  const r = await prisma.reservation.create({
    data: { roomId, guestId, channelId, checkIn: new Date("2030-03-10"), checkOut: new Date("2030-03-12"), grossAmount: 250_000 }, // ₹2,500
  });
  resId = r.id;
  await prisma.payment.create({ data: { reservationId: r.id, amount: 100_000, mode: "cash", paidAt: new Date("2030-03-10") } }); // ₹1,000
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { reservationId: resId } });
  await prisma.reservation.deleteMany({ where: { id: resId } });
  await prisma.guest.deleteMany({ where: { id: guestId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.channel.deleteMany({ where: { id: channelId } });
  await prisma.roomType.deleteMany({ where: { name: `csv-${STAMP}-t` } });
  await prisma.$disconnect();
});

// The row for this booking, split into cells.
async function rowFor(res: Response, matchOn: string): Promise<string[]> {
  const line = (await res.text()).split("\n").find((l) => l.includes(matchOn));
  expect(line, `expected a CSV row containing ${matchOn}`).toBeTruthy();
  return line!.split(",");
}

describe("CSV money parity (rupees, not paise)", () => {
  it("bookings CSV emits whole-rupee Gross / Collected / Balance", async () => {
    const cells = await rowFor(await reservationsCsv(new Request("http://localhost/api/export/reservations.csv")), resId);
    // Headers: …, Gross, Collected, Balance are indexes 10,11,12.
    expect(cells[10]).toBe("2500"); // ₹2,500 — NOT 250000
    expect(cells[11]).toBe("1000"); // ₹1,000
    expect(cells[12]).toBe("1500"); // balance ₹1,500
  });

  it("payments CSV emits the whole-rupee Amount", async () => {
    const cells = await rowFor(await paymentsCsv(new Request("http://localhost/api/export/payments.csv")), resId);
    // Headers: Payment ID, Booking ID, Guest, Room, Amount(4), …
    expect(cells[4]).toBe("1000"); // ₹1,000 — NOT 100000
  });
});
