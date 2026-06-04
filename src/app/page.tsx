import type { ReactNode } from "react";
import Link from "next/link";
import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { getConflicts } from "@/lib/conflicts";
import { getHousekeeping } from "@/lib/housekeeping";
import { ChannelBadge, Icon } from "@/components/ui";
import { Collapsible } from "@/components/Collapsible";
import { displayDate, displayShortDate, displayINR } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Payment status for a Today row: paid / advance-paid (balance) / unpaid.
function PayBadge({ r }: { r: SummaryReservation }) {
  const gross = Number(r.grossAmount ?? 0);
  if (gross <= 0) return null;
  const collected = r.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = gross - collected;
  if (balance <= 0) return <span className="badge badge--good">Paid</span>;
  if (collected > 0) return <span className="badge badge--warn">{displayINR(balance)} due</span>;
  return <span className="badge badge--neutral">Unpaid</span>;
}

export default async function DashboardPage() {
  const [s, conflicts, housekeeping] = await Promise.all([
    getTodaySummary(),
    getConflicts(),
    getHousekeeping(),
  ]);
  const heading = displayDate(parseDateOnly(s.date));
  const conflictN = conflicts.length;
  const cleanN = housekeeping.toCleanCount;

  return (
    <main className="app-main">
      <div className="entrance">
        <div className="pagehead">
          <div className="display">Today</div>
          <div className="pagehead__sub">{heading}</div>
        </div>

        {conflictN > 0 && (
          <Link href="/conflicts" className="banner banner--danger">
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span className="banner__txt">
              <b>{conflictN} booking conflict{conflictN === 1 ? "" : "s"}</b>{" "}
              {conflictN === 1 ? "needs" : "need"} attention
            </span>
            <span className="banner__arrow"><Icon name="arrowR" size={17} /></span>
          </Link>
        )}
        {cleanN > 0 && (
          <Link href="/housekeeping" className="banner banner--warn">
            <span className="banner__icon"><Icon name="clean" size={18} /></span>
            <span className="banner__txt">
              <b>{cleanN} room{cleanN === 1 ? "" : "s"}</b> to clean
            </span>
            <span className="banner__arrow"><Icon name="arrowR" size={17} /></span>
          </Link>
        )}

        <div style={{ height: 16 }} />

        {/* Verdict-first KPI strip: one container, hairline panels, navy occupancy. */}
        <div className="kpi-strip">
          <div className="kpi-panel kpi-panel--verdict">
            <div className="kpi-eyebrow">Occupancy</div>
            <div className="kpi-num">{s.occupancyPct}%</div>
            <div className="kpi-ctx">{s.occupiedRooms} of {s.totalRooms} rooms</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">In-house</div>
            <div className="kpi-num">{s.inHouse.length}</div>
            <div className="kpi-ctx">guests tonight</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Check-ins</div>
            <div className="kpi-num">{s.checkInsToday.length}</div>
            <div className="kpi-ctx">expected today</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Check-outs</div>
            <div className="kpi-num">{s.checkOutsToday.length}</div>
            <div className="kpi-ctx">leaving today</div>
          </div>
        </div>

        {/* Arrivals / Departures are the day's to-do. */}
        <SectionHead title="Arrivals today" count={s.checkInsToday.length} />
        <List items={s.checkInsToday} empty="No arrivals today." showTime showArrived showPayment />

        <SectionHead title="Departures today" count={s.checkOutsToday.length} />
        <List items={s.checkOutsToday} empty="No departures today." showDeparted showPayment />

        {/* In-house is the only full list of who's staying — collapsed so it
            no longer duplicates Arrivals at a glance. */}
        <Collapsible title="In-house now" count={s.inHouse.length}>
          <List items={s.inHouse} empty="Nobody checked in." />
        </Collapsible>

        <SectionHead
          title="Next 7 days"
          count={s.arrivalsNext7.length}
          action={<Link href="/calendar" className="section-label__a">Calendar <Icon name="arrowR" size={13} /></Link>}
        />
        <List items={s.arrivalsNext7.slice(0, 3)} empty="Nothing booked yet." showDate />
        {s.arrivalsNext7.length > 3 && (
          <Link href="/calendar" className="section-label__a" style={{ display: "inline-flex", marginTop: 12 }}>
            +{s.arrivalsNext7.length - 3} more arriving <Icon name="arrowR" size={13} />
          </Link>
        )}
      </div>
    </main>
  );
}

function SectionHead({ title, count, action }: { title: string; count: number; action?: ReactNode }) {
  return (
    <div className="section-label">
      <div className="section-label__l">
        <span className="section-label__t">{title}</span>
        <span className="section-label__c">{count}</span>
      </div>
      {action}
    </div>
  );
}

function List({
  items,
  empty,
  showTime,
  showArrived,
  showDeparted,
  showDate,
  showPayment,
}: {
  items: SummaryReservation[];
  empty: string;
  showTime?: boolean;
  showArrived?: boolean;
  showDeparted?: boolean;
  showDate?: boolean;
  showPayment?: boolean;
}) {
  if (items.length === 0) return <div className="empty">{empty}</div>;
  return (
    <>
      {items.map((r) => (
        <Link key={r.id} href={`/reservations/${r.id}`} className="rowcard">
          {showTime && <span className="rowcard__time">{r.arrivalTime || "—"}</span>}
          <div className="rowcard__main">
            <div className="rowcard__name">{r.guest.name}</div>
            <div className="rowcard__meta">Room {r.room.label} · {r.room.roomType.name}</div>
          </div>
          <div className="rowcard__right">
            <ChannelBadge name={r.channel.name} />
            {showPayment && <PayBadge r={r} />}
            {showArrived && r.checkedInAt && <span className="badge badge--good">Arrived</span>}
            {showDeparted && r.checkedOutAt && <span className="badge badge--good">Departed</span>}
            {showDate && <span className="rowcard__time">{displayShortDate(r.checkIn)}</span>}
          </div>
        </Link>
      ))}
    </>
  );
}
