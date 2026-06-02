import Link from "next/link";
import { format } from "date-fns";
import { getCalendar, type CalendarCell } from "@/lib/calendar";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";
import { displayShortDate } from "@/lib/format";
import { PageHead, Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROOMW = 96;
const VIEWS = [
  { key: "week", label: "Week" },
  { key: "2wk", label: "2 Weeks" },
  { key: "month", label: "Month" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

// First day of month (y, m) as YYYY-MM-DD; Date.UTC normalises month over/underflow.
function monthStart(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

function headerParts(dateStr: string) {
  const d = parseDateOnly(dateStr);
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { dow: format(local, "EEE"), day: String(d.getUTCDate()) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; view?: string }>;
}) {
  const params = await searchParams;
  const today = todayDateOnly();
  const view: ViewKey = VIEWS.some((v) => v.key === params.view)
    ? (params.view as ViewKey)
    : "2wk";
  const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? params.start! : today;

  // Each view fixes the window length and how prev/next page through time.
  let start: string;
  let days: number;
  let prev: string;
  let next: string;
  if (view === "month") {
    const base = parseDateOnly(rawStart);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    start = monthStart(y, m);
    days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // last day-of-month number
    prev = monthStart(y, m - 1);
    next = monthStart(y, m + 1);
  } else {
    days = view === "week" ? 7 : 14;
    start = rawStart;
    prev = addDays(start, -days);
    next = addDays(start, days);
  }

  const cal = await getCalendar(start, days);
  const compact = view === "month";
  const COLW = view === "month" ? 44 : view === "week" ? 104 : 86;

  const sub = `${displayShortDate(parseDateOnly(cal.dates[0]))} – ${displayShortDate(
    parseDateOnly(cal.dates[cal.dates.length - 1]),
  )} · ${cal.rows.length} rooms`;

  const cols = `${ROOMW}px repeat(${cal.dates.length}, ${COLW}px)`;

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead title="Calendar" sub={sub} />

        <div className="row" style={{ gap: 6, margin: "12px 0 8px" }}>
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/calendar?view=${v.key}&start=${start}`}
              className={`btn btn--sm ${view === v.key ? "btn--dark" : "btn--outline"}`}
            >
              {v.label}
            </Link>
          ))}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "0 0 2px" }}>
          <Link href={`/calendar?view=${view}&start=${prev}`} className="btn btn--outline btn--sm" aria-label="Previous">
            <Icon name="chevronL" size={16} />
          </Link>
          <Link href={`/calendar?view=${view}&start=${next}`} className="btn btn--outline btn--sm" aria-label="Next">
            <Icon name="chevronR" size={16} />
          </Link>
          <Link href={`/calendar?view=${view}`} className="btn btn--ghost btn--sm">Today</Link>
          <Link href="/settings" className="btn btn--ghost btn--sm" aria-label="Block a room"><Icon name="x" size={15} /> Block a room</Link>
          <form method="get" className="row" style={{ gap: 6, marginLeft: "auto" }}>
            <input type="hidden" name="view" value={view} />
            <input type="date" name="start" defaultValue={start} className="input" style={{ width: 152, padding: "8px 11px", fontSize: 14 }} />
            <button className="btn btn--dark btn--sm">Go</button>
          </form>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "14px 0 12px" }}>
          <Legend swatch="var(--paper)" label="Vacant" />
          <Legend swatch="var(--teal-50)" label="Occupied" />
          <Legend swatch="#ece5da" label="Blocked" />
          <Legend swatch="var(--danger-50)" label="Conflict" />
          <Legend swatch="var(--good)" label="Arriving" edge />
          <Legend swatch="var(--clay)" label="Departing" edge />
        </div>

        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={{ minWidth: ROOMW + COLW * cal.dates.length }}>
              {/* header */}
              <div style={{ display: "grid", gridTemplateColumns: cols, position: "sticky", top: 0 }}>
                <div style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--sand)", padding: "11px 12px", fontWeight: 700, fontSize: 12.5, borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
                  Room
                </div>
                {cal.dates.map((d, i) => {
                  const isToday = d === today;
                  const { dow, day } = headerParts(d);
                  return (
                    <div key={d} style={{ padding: "9px 8px", textAlign: "center", borderBottom: "1px solid var(--line)", borderRight: i < cal.dates.length - 1 ? "1px solid var(--line)" : 0, background: isToday ? "var(--teal-50)" : "var(--sand)" }}>
                      <div className="eyebrow" style={{ fontSize: 9.5, color: isToday ? "var(--teal-700)" : "var(--subtle)" }}>{dow}</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: isToday ? "var(--teal-700)" : "var(--ink)" }}>{day}</div>
                    </div>
                  );
                })}
              </div>
              {/* rows */}
              {cal.rows.map((room, ri) => (
                <div key={room.id} style={{ display: "grid", gridTemplateColumns: cols }}>
                  <div style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--paper)", padding: "10px 12px", borderRight: "1px solid var(--line)", borderBottom: ri < cal.rows.length - 1 ? "1px solid var(--line)" : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{room.label}</div>
                    <div style={{ fontSize: 10.5, color: "var(--subtle)", lineHeight: 1.2 }}>{room.roomTypeName}</div>
                  </div>
                  {room.cells.map((cell, di) => (
                    <CalCell
                      key={cell.date}
                      cell={cell}
                      compact={compact}
                      lastCol={di === cal.dates.length - 1}
                      lastRow={ri === cal.rows.length - 1}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--subtle)", marginTop: 10, textAlign: "center" }}>
          Swipe across to see more dates · tap a booking to open it
        </div>
      </div>
    </main>
  );
}

function CalCell({ cell, compact, lastCol, lastRow }: { cell: CalendarCell; compact: boolean; lastCol: boolean; lastRow: boolean }) {
  const border = {
    borderRight: lastCol ? 0 : "1px solid var(--line)",
    borderBottom: lastRow ? 0 : "1px solid var(--line)",
  };

  if (cell.state === "occupied" || cell.state === "conflict") {
    const title = cell.state === "conflict" ? "Conflict" : cell.reservation!.guestName;
    return (
      <Link
        href={`/reservations/${cell.reservation!.id}`}
        title={compact ? title : undefined}
        className={`cal-cell ${cell.state === "conflict" ? "cal-cell--conflict" : "cal-cell--occ"}`}
        style={{ ...border }}
      >
        {cell.arriving && <span className="cal-edge-arr" />}
        {cell.departing && <span className="cal-edge-dep" />}
        {compact ? null : cell.state === "conflict" ? (
          <div className="cal-guest">Conflict</div>
        ) : (
          <>
            <div className="cal-guest">{cell.reservation!.guestName.split(" ")[0]}</div>
            <div className="cal-ch">{cell.reservation!.channelName}</div>
          </>
        )}
      </Link>
    );
  }
  if (cell.state === "blocked") {
    return (
      <div className="cal-cell cal-cell--blocked" title={compact ? cell.blockReason ?? "Blocked" : undefined} style={border}>
        {compact ? null : (
          <>
            <div style={{ fontWeight: 600, fontSize: 11.5 }}>Blocked</div>
            {cell.blockReason}
          </>
        )}
      </div>
    );
  }
  return <div className="cal-cell" style={{ ...border, background: "var(--paper)" }} />;
}

function Legend({ swatch, label, edge }: { swatch: string; label: string; edge?: boolean }) {
  return (
    <div className="row" style={{ gap: 7, fontSize: 12.5, color: "var(--deep-teal)", fontWeight: 500 }}>
      {edge ? (
        <span style={{ width: 4, height: 16, borderRadius: 2, background: swatch, display: "inline-block" }} />
      ) : (
        <span style={{ width: 16, height: 16, borderRadius: 5, background: swatch, border: "1px solid var(--line-strong)", display: "inline-block" }} />
      )}
      {label}
    </div>
  );
}
