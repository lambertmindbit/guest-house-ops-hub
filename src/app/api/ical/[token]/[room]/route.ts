import { prisma } from "@/lib/prisma";
import { buildIcsFeed, type IcalEvent } from "@/lib/ical";
import { todayDateOnly, parseDateOnly } from "@/lib/dates";

// Public, token-gated feed (OTAs fetch it without our login cookie). The token
// in the path is the only secret, so compare it in constant time and 404 on
// any mismatch to avoid confirming whether a room exists.
function validToken(token: string): boolean {
  const expected = process.env.ICAL_FEED_TOKEN ?? "";
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; room: string }> },
) {
  const { token, room } = await params;
  if (!validToken(token)) return notFound();

  const roomId = room.replace(/\.ics$/i, "");
  const roomRow = await prisma.room.findUnique({
    where: { id: roomId },
    include: { roomType: true },
  });
  if (!roomRow) return notFound();

  // Only current/future busy periods keep the feed small.
  const fromDate = parseDateOnly(todayDateOnly());
  const [reservations, blocks] = await Promise.all([
    prisma.reservation.findMany({
      where: { roomId, status: "confirmed", checkOut: { gte: fromDate } },
    }),
    prisma.block.findMany({
      where: { roomId, endDate: { gte: fromDate } },
    }),
  ]);

  // Anonymised on purpose — OTAs only need "busy", never guest details.
  const events: IcalEvent[] = [
    ...reservations.map((r) => ({
      uid: `res-${r.id}@ops-hub`,
      start: r.checkIn,
      end: r.checkOut,
      summary: "Reserved",
    })),
    ...blocks.map((b) => ({
      uid: `blk-${b.id}@ops-hub`,
      start: b.startDate,
      end: b.endDate,
      summary: "Blocked",
    })),
  ];

  const ics = buildIcsFeed(`${roomRow.label} – ${roomRow.roomType.name}`, events);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=300",
      "content-disposition": `inline; filename="room-${roomRow.label}.ics"`,
    },
  });
}
