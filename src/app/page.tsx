import type { ReactNode } from "react";
import Link from "next/link";
import { getTodaySummary, type SummaryReservation } from "@/lib/dashboard";
import { getT } from "@/lib/i18n/server";
import { getConflicts } from "@/lib/conflicts";
import { getHousekeeping } from "@/lib/housekeeping";
import { getPendingPayments } from "@/lib/finance";
import { staleFeedCount } from "@/lib/feed-health";
import { currentRole } from "@/lib/session";
import { canSeeMoney } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ChannelBadge, Icon } from "@/components/ui";
import { displayDate, displayShortDate, displayINR } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

const RAIL_ROWS = 4; // a rail is for glancing; past this it stops being one

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
  const [s, conflicts, housekeeping, openEscalations, pending, activeFeeds] = await Promise.all([
    getTodaySummary(),
    getConflicts(),
    getHousekeeping(),
    prisma.escalation.count({ where: { status: "open" } }),
    getPendingPayments(),
    prisma.icalFeed.findMany({ where: { active: true }, select: { active: true, lastSyncedAt: true, lastError: true } }),
  ]);
  // Stale/failed iCal feeds mean imported OTA busy-dates are silently out of date
  // (GAP-5) — the exact moment a double-book slips in. Surface it, don't hide it.
  const staleFeeds = staleFeedCount(activeFeeds, new Date());
  const t = await getT();
  const showMoney = canSeeMoney(await currentRole());
  const heading = displayDate(parseDateOnly(s.date));
  const conflictN = conflicts.length;
  // One merged "Needs you" signal: booking conflicts + open agent approvals.
  const needsN = conflictN + openEscalations;
  const needsParts = [
    conflictN > 0 ? `${conflictN} booking conflict${conflictN === 1 ? "" : "s"}` : null,
    openEscalations > 0 ? `${openEscalations} approval${openEscalations === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
  const toClean = housekeeping.rooms.filter((r) => r.needsCleaning);

  // First-run: no rooms means the property isn't set up yet. Point the owner at the
  // onboarding wizard instead of a blank Today (GAP-18/US-702). Uses the summary's
  // existing totalRooms — no extra query.
  if (s.totalRooms === 0) {
    return (
      <main className="app-main">
        <div className="entrance">
          <div className="pagehead">
            <div className="display">{t("dashboard.welcome")}</div>
          </div>
          <div className="banner banner--warn" style={{ cursor: "default", margin: "12px 0 16px" }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}>{t("dashboard.notSetUp")}</span>
          </div>
          <Link href="/onboarding" className="btn btn--primary btn--block">
            <Icon name="check" size={16} /> {t("dashboard.startSetup")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="entrance">
        <div className="pagehead">
          <div className="display">Today</div>
          <div className="pagehead__sub">{heading}</div>
        </div>

        <div className="dash">
          {/* Sole alert. On desktop it heads the rail; on a phone the grid hoists
              it above everything, because an alarm you scroll to is not an alarm. */}
          {needsN > 0 && (
            <Link href="/needs-you" className="dash__alert railcard railcard--alert">
              <span className="railcard__ic"><Icon name="alert" size={18} /></span>
              <span className="railcard__m">
                <span className="railcard__k">Needs you</span>
                <span className="railcard__v">{needsN} thing{needsN === 1 ? "" : "s"}</span>
                <span className="railcard__s">{needsParts}</span>
              </span>
              <Icon name="arrowR" size={17} />
            </Link>
          )}

          {/* Verdict first: occupancy is the day's headline, arrivals/departures its shape. */}
          <div className="dash__kpis kpi-strip kpi-strip--3">
            <div className="kpi-panel kpi-panel--verdict">
              <div className="kpi-eyebrow">{t("dashboard.occupancy")}</div>
              <div className="kpi-num">{s.occupancyPct}%</div>
              <div className="kpi-ctx">{t("dashboard.roomsOf", { occupied: s.occupiedRooms, total: s.totalRooms })}</div>
            </div>
            <div className="kpi-panel">
              <div className="kpi-eyebrow">{t("dashboard.arrivals")}</div>
              <div className="kpi-num">{s.checkInsToday.length}</div>
              <div className="kpi-ctx">today</div>
            </div>
            <div className="kpi-panel">
              <div className="kpi-eyebrow">{t("dashboard.departures")}</div>
              <div className="kpi-num">{s.checkOutsToday.length}</div>
              <div className="kpi-ctx">today</div>
            </div>
          </div>

          {/* THE DAY'S WORK — read top to bottom, it is the running order of the
              day: who arrives, the rooms that must be ready for them, who leaves. */}
          <div className="dash__work">
            <Panel title="Arrivals today" count={s.checkInsToday.length}>
              <List items={s.checkInsToday} empty="No arrivals today." showTime showArrived showPayment />
            </Panel>

            <Panel
              title="To clean"
              count={housekeeping.toCleanCount}
              action={<Link href="/housekeeping" className="section-label__a">Housekeeping <Icon name="arrowR" size={13} /></Link>}
              flush={false}
            >
              {toClean.length === 0 ? (
                <div style={{ color: "var(--text-subtle)", fontSize: "var(--fs-meta)" }}>All rooms clean.</div>
              ) : (
                <>
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
                </>
              )}
            </Panel>

            <Panel title="Departures today" count={s.checkOutsToday.length}>
              <List items={s.checkOutsToday} empty="No departures today." showDeparted showPayment />
            </Panel>
          </div>

          {/* THE RAIL — things you check, not things you do. */}
          <aside className="dash__rail">
            {staleFeeds > 0 && (
              <Link href="/settings/feeds" className="railcard" style={{ borderColor: "var(--amber-line, #ecd6b3)", background: "var(--amber-fill, #fffbeb)" }}>
                <span className="railcard__ic" style={{ color: "var(--amber-text, #b45309)" }}><Icon name="alert" size={18} /></span>
                <span className="railcard__m">
                  <span className="railcard__k">Sync may be stale</span>
                  <span className="railcard__v">{staleFeeds} feed{staleFeeds === 1 ? "" : "s"}</span>
                  <span className="railcard__s">Not synced in over 12h — OTA dates could be out of date</span>
                </span>
                <span className="railcard__go"><Icon name="arrowR" size={17} /></span>
              </Link>
            )}
            {showMoney && (
              <Link href="/finance" className="railcard railcard--money">
                <span className="railcard__ic"><Icon name="wallet" size={18} /></span>
                <span className="railcard__m">
                  <span className="railcard__k">Pending payments</span>
                  <span className="railcard__v">{displayINR(pending.total)}</span>
                  <span className="railcard__s">
                    {pending.count > 0 ? `across ${pending.count} booking${pending.count === 1 ? "" : "s"}` : "all settled"}
                  </span>
                </span>
                <span className="railcard__go"><Icon name="arrowR" size={17} /></span>
              </Link>
            )}

            <Panel title="In-house now" count={s.inHouse.length}>
              <List items={s.inHouse.slice(0, RAIL_ROWS)} empty="Nobody checked in." compact />
              {s.inHouse.length > RAIL_ROWS && (
                <Link href="/reservations" className="panel__more">
                  +{s.inHouse.length - RAIL_ROWS} more in house <Icon name="arrowR" size={13} />
                </Link>
              )}
            </Panel>

            <Panel
              title="Next 7 days"
              count={s.arrivalsNext7.length}
              action={<Link href="/calendar" className="section-label__a">Calendar <Icon name="arrowR" size={13} /></Link>}
            >
              <List items={s.arrivalsNext7.slice(0, RAIL_ROWS)} empty="Nothing booked yet." showDate compact />
              {s.arrivalsNext7.length > RAIL_ROWS && (
                <Link href="/calendar" className="panel__more">
                  +{s.arrivalsNext7.length - RAIL_ROWS} more arriving <Icon name="arrowR" size={13} />
                </Link>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

/**
 * A titled container.
 *
 * `flush` (the default) means the body has no padding, so a row list reads as one
 * divided table rather than a stack of cards inside a card. Pass `flush={false}`
 * for free-form content that needs its own breathing room.
 */
function Panel({
  title,
  count,
  action,
  flush = true,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel__hd">
        <div className="panel__l">
          <span className="panel__t">{title}</span>
          <span className="panel__c">{count}</span>
        </div>
        {action}
      </div>
      <div className={flush ? "panel__rows" : "panel__bd"}>{children}</div>
    </section>
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
  compact,
}: {
  items: SummaryReservation[];
  empty: string;
  showTime?: boolean;
  showArrived?: boolean;
  showDeparted?: boolean;
  showDate?: boolean;
  showPayment?: boolean;
  /** Rail width: drop the channel badge so the name and room stay readable. */
  compact?: boolean;
}) {
  if (items.length === 0) return <div className="panel__empty">{empty}</div>;
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
            {!compact && <ChannelBadge name={r.channel.name} />}
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
