import type { ReactNode } from "react";
import Link from "next/link";
import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { getConflicts } from "@/lib/conflicts";
import { getHousekeeping } from "@/lib/housekeeping";
import { getPendingPayments } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
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
  const [s, conflicts, housekeeping, openEscalations, pending] = await Promise.all([
    getTodaySummary(),
    getConflicts(),
    getHousekeeping(),
    prisma.escalation.count({ where: { status: "open" } }),
    getPendingPayments(),
  ]);
  const heading = displayDate(parseDateOnly(s.date));
  const conflictN = conflicts.length;
  // One merged "Needs you" signal: booking conflicts + open agent approvals.
  const needsN = conflictN + openEscalations;
  const needsParts = [
    conflictN > 0 ? `${conflictN} booking conflict${conflictN === 1 ? "" : "s"}` : null,
    openEscalations > 0 ? `${openEscalations} approval${openEscalations === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
  const toClean = housekeeping.rooms.filter((r) => r.needsCleaning);

  return (
    <main className="app-main">
      <div className="entrance">
        <div className="pagehead">
          <div className="display">Today</div>
          <div className="pagehead__sub">{heading}</div>
        </div>

        {needsN > 0 && (
          <Link href="/needs-you" className="banner banner--danger">
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span className="banner__txt">
              <b>{needsN} thing{needsN === 1 ? "" : "s"} need{needsN === 1 ? "s" : ""} you</b> — {needsParts}
            </span>
            <span className="banner__arrow"><Icon name="arrowR" size={17} /></span>
          </Link>
        )}

        <div style={{ height: 16 }} />

        {/* Verdict-first 3-up: Occupancy (navy) · Arrivals · Departures. The day's
            to-do (arrivals + cleaning) wins the screen below, not four KPI blocks. */}
        <div className="kpi-strip kpi-strip--3">
          <div className="kpi-panel kpi-panel--verdict">
            <div className="kpi-eyebrow">Occupancy</div>
            <div className="kpi-num">{s.occupancyPct}%</div>
            <div className="kpi-ctx">{s.occupiedRooms} of {s.totalRooms} rooms</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Arrivals</div>
            <div className="kpi-num">{s.checkInsToday.length}</div>
            <div className="kpi-ctx">today</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Departures</div>
            <div className="kpi-num">{s.checkOutsToday.length}</div>
            <div className="kpi-ctx">today</div>
          </div>
        </div>

        {/* Payments pending — money still owed across confirmed bookings. */}
        {pending.count > 0 && (
          <Link href="/finance" className="banner banner--warn" style={{ marginTop: 12 }}>
            <span className="banner__icon"><Icon name="wallet" size={18} /></span>
            <span className="banner__txt">
              <b>{displayINR(pending.total)} pending</b> across {pending.count} booking{pending.count === 1 ? "" : "s"}
            </span>
            <span className="banner__arrow"><Icon name="arrowR" size={17} /></span>
          </Link>
        )}

        {/* Arrivals / Departures are the day's to-do. */}
        <SectionHead title="Arrivals today" count={s.checkInsToday.length} />
        <List items={s.checkInsToday} empty="No arrivals today." showTime showArrived showPayment />

        {/* Promoted housekeeping — the morning routine belongs on the dashboard. */}
        <SectionHead
          title="To clean"
          count={housekeeping.toCleanCount}
          action={<Link href="/housekeeping" className="section-label__a">Housekeeping <Icon name="arrowR" size={13} /></Link>}
        />
        {toClean.length === 0 ? (
          <div className="empty">All rooms clean.</div>
        ) : (
          <div className="card card--pad clean-card">
            <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>Clean before tonight’s arrivals.</div>
            <div className="room-chips">
              {toClean.map((r) => (
                <div key={r.id} className={`room-chip${r.highPriority ? " room-chip--prio" : ""}`}>
                  <b>{r.label}</b>
                  <small>{r.highPriority ? "Arriving soon" : "Checked out"}</small>
                </div>
              ))}
            </div>
            <Link href="/housekeeping" className="btn btn--primary btn--block" style={{ marginTop: 12 }}>
              <Icon name="check" size={16} /> Mark a room clean
            </Link>
          </div>
        )}

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
