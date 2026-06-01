import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { ChannelBadge } from "@/components/ChannelBadge";
import { displayDate, displayShortDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

// Data changes constantly; never statically cache this page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getTodaySummary();
  const heading = displayDate(parseDateOnly(s.date));

  return (
    <main className="mx-auto max-w-md p-4 pb-10 lg:max-w-5xl">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-neutral-500">{heading}</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Occupancy" value={`${s.occupancyPct}%`} hint={`${s.occupiedRooms}/${s.totalRooms} rooms`} />
        <Stat label="In-house" value={s.inHouse.length} />
        <Stat label="Check-ins" value={s.checkInsToday.length} />
        <Stat label="Check-outs" value={s.checkOutsToday.length} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Check-ins today" items={s.checkInsToday} empty="No arrivals today." />
        <Section title="Check-outs today" items={s.checkOutsToday} empty="No departures today." />
        <Section title="In-house now" items={s.inHouse} empty="Nobody checked in." />
        <Section title="Arrivals next 7 days" items={s.arrivalsNext7} empty="Nothing booked yet." showDate />
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {hint && <div className="text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  items,
  empty,
  showDate,
}: {
  title: string;
  items: SummaryReservation[];
  empty: string;
  showDate?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">
        {title} <span className="text-neutral-400">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <ReservationItem key={r.id} reservation={r} showDate={showDate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReservationItem({
  reservation: r,
  showDate,
}: {
  reservation: SummaryReservation;
  showDate?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{r.guest.name}</div>
        <div className="truncate text-xs text-neutral-500">
          Room {r.room.label} · {r.room.roomType.name}
          {r.arrivalTime ? ` · arr ${r.arrivalTime}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <ChannelBadge name={r.channel.name} />
        {showDate && (
          <span className="text-xs text-neutral-500">{displayShortDate(r.checkIn)}</span>
        )}
      </div>
    </li>
  );
}
