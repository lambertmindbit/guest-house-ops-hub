import type { ReactNode } from "react";
import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { getConflicts } from "@/lib/conflicts";
import { getHousekeeping } from "@/lib/housekeeping";
import { PageHead, SectionLabel, KPI, AlertBanner, GuestRow } from "@/components/ui";
import { displayDate, displayShortDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [s, conflicts, housekeeping] = await Promise.all([
    getTodaySummary(),
    getConflicts(),
    getHousekeeping(),
  ]);
  const heading = displayDate(parseDateOnly(s.date));

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead title="Today" sub={heading} />

        {(conflicts.length > 0 || housekeeping.toCleanCount > 0) && (
          <div className="col" style={{ gap: 12, marginTop: 18 }}>
            {conflicts.length > 0 && (
              <AlertBanner tone="danger" icon="alert" href="/conflicts">
                <b style={{ fontWeight: 700 }}>
                  {conflicts.length} booking conflict{conflicts.length === 1 ? "" : "s"}
                </b>{" "}
                need{conflicts.length === 1 ? "s" : ""} attention
              </AlertBanner>
            )}
            {housekeeping.toCleanCount > 0 && (
              <AlertBanner tone="warn" icon="clean" href="/housekeeping">
                <b style={{ fontWeight: 700 }}>
                  {housekeeping.toCleanCount} room{housekeeping.toCleanCount === 1 ? "" : "s"}
                </b>{" "}
                to clean
              </AlertBanner>
            )}
          </div>
        )}

        <div className="kpi-grid" style={{ marginTop: 16 }}>
          <KPI value={`${s.occupancyPct}%`} label="Occupancy" sub={`${s.occupiedRooms}/${s.totalRooms} rooms`} icon="bed" tone="teal" />
          <KPI value={s.inHouse.length} label="In-house" icon="guests" />
          <KPI value={s.checkInsToday.length} label="Check-ins" icon="arrowR" />
          <KPI value={s.checkOutsToday.length} label="Check-outs" icon="logout" />
        </div>

        <div className="two-col">
          <div>
            <Section title="Check-ins today" items={s.checkInsToday} empty="No arrivals today." right={(r) => (r.checkedInAt ? "Arrived ✓" : "Awaiting")} />
            <Section title="Check-outs today" items={s.checkOutsToday} empty="No departures today." right={(r) => (r.checkedOutAt ? "Departed ✓" : "Due out")} />
          </div>
          <div>
            <Section title="In-house now" items={s.inHouse} empty="Nobody checked in." right={(r) => (r.checkedInAt ? "In-house" : "Not arrived")} />
            <Section title="Arrivals next 7 days" items={s.arrivalsNext7} empty="Nothing booked yet." right={(r) => displayShortDate(r.checkIn)} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  items,
  empty,
  right,
}: {
  title: string;
  items: SummaryReservation[];
  empty: string;
  right?: (r: SummaryReservation) => ReactNode;
}) {
  return (
    <>
      <SectionLabel count={`(${items.length})`}>{title}</SectionLabel>
      {items.length === 0 ? (
        <div className="empty">{empty}</div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {items.map((r) => (
            <GuestRow
              key={r.id}
              name={r.guest.name}
              meta={`Room ${r.room.label} · ${r.room.roomType.name}${r.arrivalTime ? ` · arr ${r.arrivalTime}` : ""}`}
              channel={r.channel.name}
              right={right?.(r)}
              href={`/reservations/${r.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
