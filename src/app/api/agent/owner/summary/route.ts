import { ok, fail } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { formatDateOnly } from "@/lib/dates";

// GET /api/agent/owner/summary
// Read-only daily briefing for the OWNER console agent: occupancy + today's
// arrivals/departures, who's in-house, and arrivals over the next 7 days.
// Reuses getTodaySummary (same truth as the Today dashboard) and flattens each
// reservation to the few fields the agent needs to speak — no Decimals, no
// nested objects. Owner-only data, so it stays behind the agent token like the
// rest of /api/agent/*.

function shape(r: SummaryReservation) {
  return {
    guest: r.guest.name,
    phone: r.guest.phone,
    room: r.room.label,
    roomType: r.room.roomType.name,
    channel: r.channel.name,
    checkIn: formatDateOnly(r.checkIn),
    checkOut: formatDateOnly(r.checkOut),
    arrivalTime: r.arrivalTime ?? null,
  };
}

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const s = await getTodaySummary();
  return ok({
    date: s.date,
    occupancyPct: s.occupancyPct,
    totalRooms: s.totalRooms,
    occupiedRooms: s.occupiedRooms,
    counts: {
      checkInsToday: s.checkInsToday.length,
      checkOutsToday: s.checkOutsToday.length,
      inHouse: s.inHouse.length,
      arrivalsNext7: s.arrivalsNext7.length,
    },
    checkInsToday: s.checkInsToday.map(shape),
    checkOutsToday: s.checkOutsToday.map(shape),
    inHouse: s.inHouse.map(shape),
    arrivalsNext7: s.arrivalsNext7.map(shape),
  });
}
