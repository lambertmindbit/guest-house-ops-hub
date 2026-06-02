import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { parseDateOnly } from "@/lib/dates";

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Payments export for the accountant. Honours an optional from/to (by paid date).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const where =
    isDate(from) && isDate(to)
      ? { paidAt: { gte: parseDateOnly(from), lt: parseDateOnly(to) } }
      : {};

  const payments = await prisma.payment.findMany({
    where,
    include: { reservation: { include: { guest: true, room: true } } },
    orderBy: { paidAt: "asc" },
  });

  const headers = ["Payment ID", "Booking ID", "Guest", "Room", "Amount", "Mode", "Paid at", "Note"];
  const rows = payments.map((p) => [
    p.id, p.reservationId, p.reservation.guest.name, p.reservation.room.label,
    Number(p.amount), p.mode, p.paidAt.toISOString(), p.note ?? "",
  ]);

  const range = isDate(from) && isDate(to) ? `_${from}_${to}` : "";
  return csvResponse(`payments${range}.csv`, toCsv(headers, rows));
}
