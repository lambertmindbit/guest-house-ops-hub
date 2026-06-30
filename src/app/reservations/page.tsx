import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHead } from "@/components/ui";
import { BookingsList, type BookingRow } from "@/components/BookingsList";
import { displayShortDate } from "@/lib/format";
import { formatDateOnly, todayDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Derive the booking's stay-state (relative to today) for confirmed stays; for
// cancelled / no-show we surface the lifecycle status instead. Half-open stay:
// the check-out day is the departure day.
function deriveState(
  status: string,
  checkIn: Date,
  checkOut: Date,
  today: string,
): { state: BookingRow["state"]; when: string } {
  if (status === "cancelled") return { state: "cancelled", when: "" };
  if (status === "no_show") return { state: "no_show", when: "" };

  const ci = formatDateOnly(checkIn);
  const co = formatDateOnly(checkOut);
  const dayDiff = Math.round((checkIn.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  const inDays = (n: number) => (n === 1 ? "tomorrow" : `in ${n} days`);

  if (co < today) return { state: "past", when: displayShortDate(checkOut) };
  if (co === today) return { state: "departs", when: "today" };
  if (ci === today) return { state: "arrives", when: "today" };
  if (ci < today) return { state: "staying", when: `until ${displayShortDate(checkOut)}` };
  return { state: "upcoming", when: inDays(dayDiff) };
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await searchParams; // search is now client-side; param kept for back-compat deep links
  const today = todayDateOnly();

  const reservations = await prisma.reservation.findMany({
    include: {
      guest: { select: { name: true, phone: true } },
      room: { select: { label: true, roomType: { select: { name: true } } } },
      channel: { select: { name: true } },
    },
    orderBy: [{ checkIn: "desc" }],
    take: 200,
  });

  const rows: BookingRow[] = reservations.map((r) => {
    const nights = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000);
    const { state, when } = deriveState(r.status, r.checkIn, r.checkOut, today);
    return {
      id: r.id,
      name: r.guest.name,
      phone: r.guest.phone,
      room: r.room.label,
      roomType: r.room.roomType.name,
      channel: r.channel.name,
      dates: `${displayShortDate(r.checkIn)} → ${displayShortDate(r.checkOut)} (${nights}n)`,
      state,
      when,
    };
  });

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <PageHead title="Bookings" sub={`${rows.length} reservations — search or filter`} />
          <Link href="/reservations/new" className="btn btn--primary" style={{ flexShrink: 0 }}>
            + New booking
          </Link>
        </div>

        <BookingsList rows={rows} />
      </div>
    </main>
  );
}
