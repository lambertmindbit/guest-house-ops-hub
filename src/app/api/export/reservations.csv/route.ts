import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { parseDateOnly, formatDateOnly } from "@/lib/dates";

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const nights = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

// Bookings export for the accountant. Honours an optional from/to (by check-in).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where =
    isDate(from) && isDate(to)
      ? { checkIn: { gte: parseDateOnly(from), lt: parseDateOnly(to) } }
      : {};

  const reservations = await prisma.reservation.findMany({
    where,
    include: { guest: true, room: { include: { roomType: true } }, channel: true, payments: true },
    orderBy: { checkIn: "asc" },
  });

  const headers = [
    "Booking ID", "Guest", "Phone", "Room", "Room type", "Channel",
    "Check-in", "Check-out", "Nights", "Status", "Gross", "Collected", "Balance",
    "Checked in", "Checked out", "Created",
  ];
  const rows = reservations.map((r) => {
    const gross = r.grossAmount ? Number(r.grossAmount) : 0;
    const collected = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    return [
      r.id, r.guest.name, r.guest.phone, r.room.label, r.room.roomType.name, r.channel.name,
      formatDateOnly(r.checkIn), formatDateOnly(r.checkOut), nights(r.checkIn, r.checkOut),
      r.status, gross, collected, gross - collected,
      r.checkedInAt?.toISOString() ?? "", r.checkedOutAt?.toISOString() ?? "",
      r.createdAt.toISOString(),
    ];
  });

  const range = isDate(from) && isDate(to) ? `_${from}_${to}` : "";
  return csvResponse(`reservations${range}.csv`, toCsv(headers, rows));
}
