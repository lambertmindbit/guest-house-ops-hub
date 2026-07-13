import { withRoute } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildIcsFeed, type IcalEvent } from "@/lib/ical";
import { icalTokenValid } from "@/lib/ical-token";
import { todayDateOnly, parseDateOnly } from "@/lib/dates";

// Public, token-gated feed (OTAs fetch it without our login cookie). The token
// is PER ROOM (derived from the room id + the secret), so a leaked link exposes
// only that one room. Constant-time compare; 404 on any mismatch so we never
// confirm whether a room exists.
const notFound = () => new Response("Not found", { status: 404 });

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ token: string; room: string }> },
) {
  const { token, room } = await params;
  const roomId = room.replace(/\.ics$/i, "");
  if (!icalTokenValid(roomId, token)) return notFound();

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

export const GET = withRoute(handleGET);
