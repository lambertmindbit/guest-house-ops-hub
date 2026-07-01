import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHead } from "@/components/ui";
import { BookingsList, type BookingRow, type BookingBucket, type BookingState } from "@/components/BookingsList";
import { displayShortDate } from "@/lib/format";
import { formatDateOnly, todayDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Derive both the coarse filter bucket (Upcoming → In-house → Past, or a Cancelled
// exceptions bucket for cancelled/no-show) and the finer badge state relative to
// today. Half-open stay: on the check-out day the guest is still in-house (leaving),
// and only counts as Past once check-out has passed.
function deriveState(
  status: string,
  checkIn: Date,
  checkOut: Date,
  today: string,
): { bucket: BookingBucket; state: BookingState; when: string } {
  if (status === "cancelled") return { bucket: "cancelled", state: "cancelled", when: "" };
  if (status === "no_show") return { bucket: "cancelled", state: "no_show", when: "" };

  const ci = formatDateOnly(checkIn);
  const co = formatDateOnly(checkOut);
  const dayDiff = Math.round((checkIn.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  const inDays = (n: number) => (n === 1 ? "tomorrow" : `in ${n} days`);

  if (co < today) return { bucket: "past", state: "past", when: displayShortDate(checkOut) };
  if (co === today) return { bucket: "in_house", state: "departs", when: "today" };
  if (ci === today) return { bucket: "in_house", state: "arrives", when: "today" };
  if (ci < today) return { bucket: "in_house", state: "staying", when: `until ${displayShortDate(checkOut)}` };
  return { bucket: "upcoming", state: "upcoming", when: inDays(dayDiff) };
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
    const { bucket, state, when } = deriveState(r.status, r.checkIn, r.checkOut, today);
    return {
      id: r.id,
      name: r.guest.name,
      phone: r.guest.phone,
      room: r.room.label,
      roomType: r.room.roomType.name,
      channel: r.channel.name,
      dates: `${displayShortDate(r.checkIn)} → ${displayShortDate(r.checkOut)} (${nights}n)`,
      bucket,
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
