"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import type { CalendarCell } from "@/lib/calendar";
import { ChannelBadge, Icon } from "@/components/ui";

export type CalView = "day" | "week" | "2wk" | "month";

type Row = { id: string; label: string; roomTypeName: string; cells: CalendarCell[] };
type Nav = { prev: string; next: string; today: string };

const VIEW_OPTS: { k: CalView; label: string }[] = [
  { k: "day", label: "Day" },
  { k: "week", label: "Week" },
  { k: "2wk", label: "2 Wks" },
  { k: "month", label: "Month" },
];

// Solid dot colours for the grid (channel badges are tinted; the grid needs a
// single saturated dot that reads at 6px).
const CH_DOT: Record<string, string> = {
  Direct: "#0f766e",
  WhatsApp: "#16a34a",
  "Booking.com": "#2563eb",
  Agoda: "#e11d48",
  MakeMyTrip: "#ea580c",
};

function dParts(d: string) {
  const dt = parseDateOnly(d);
  const local = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  return { dow: format(local, "EEE"), day: dt.getUTCDate(), mon: format(local, "MMM") };
}

export function CalendarBoard({
  view,
  dates,
  rows,
  today,
  sub,
  start,
  nav,
}: {
  view: CalView;
  dates: string[];
  rows: Row[];
  today: string;
  sub: string;
  start: string;
  nav: Nav;
}) {
  return (
    <>
      <div className="pagehead">
        <div className="display">Calendar</div>
        <div className="pagehead__sub">{sub}</div>
      </div>

      {/* view selector */}
      <div className="seg" style={{ marginBottom: 12, maxWidth: "100%", overflowX: "auto" }}>
        {VIEW_OPTS.map((v) => (
          <Link key={v.k} href={`/calendar?view=${v.k}&start=${start}`} className={view === v.k ? "on" : ""}>{v.label}</Link>
        ))}
      </div>

      {/* window navigation */}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href={nav.prev} className="btn btn--ghost btn--sm" aria-label="Previous"><Icon name="chevronL" size={16} /></Link>
        <Link href={nav.today} className="btn btn--ghost btn--sm">Today</Link>
        <Link href={nav.next} className="btn btn--ghost btn--sm" aria-label="Next"><Icon name="chevronR" size={16} /></Link>
        <form method="get" action="/calendar" className="row" style={{ gap: 6, marginLeft: "auto" }}>
          <input type="hidden" name="view" value={view} />
          <input type="date" name="start" defaultValue={dates[0]} className="input" style={{ width: 150 }} />
          <button className="btn btn--ghost btn--sm">Go</button>
        </form>
      </div>

      {view === "day" ? (
        <DayView dates={dates} rows={rows} today={today} />
      ) : (
        <GridView dates={dates} rows={rows} today={today} />
      )}

      <div style={{ height: 14 }} />
      <Link href="/settings/blocks" className="btn btn--ghost btn--block">
        <Icon name="x" size={16} /> Block a room
      </Link>
    </>
  );
}

function DayView({ dates, rows, today }: { dates: string[]; rows: Row[]; today: string }) {
  const initialSel = Math.max(0, dates.indexOf(today));
  const [sel, setSel] = useState(initialSel);
  const selDate = dates[sel] ?? dates[0];

  const booked = rows.filter((r) => r.cells[sel]?.state === "occupied").length;
  const blocked = rows.filter((r) => r.cells[sel]?.state === "blocked").length;
  const { dow, day, mon } = dParts(selDate);

  return (
    <>
      <div className="daystrip">
        {dates.map((d, i) => {
          const p = dParts(d);
          const hasBooking = rows.some((r) => {
            const s = r.cells[i]?.state;
            return s === "occupied" || s === "conflict" || s === "blocked";
          });
          return (
            <button
              key={d}
              className={`daycell${i === sel ? " on" : ""}${d === today ? " today" : ""}`}
              onClick={() => setSel(i)}
            >
              <div className="daycell__dow">{p.dow}</div>
              <div className="daycell__d">{p.day}</div>
              {hasBooking && <div className="daycell__dot" />}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: "space-between", margin: "4px 2px 12px" }}>
        <span className="h3">{dow} {day} {mon}</span>
        <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{booked} of {rows.length} booked{blocked > 0 ? ` · ${blocked} blocked` : ""}</span>
      </div>

      {rows.map((r) => {
        const c = r.cells[sel];
        const state = c?.state ?? "vacant";
        const cls =
          state === "conflict" ? " dayrow--conflict" :
          state === "blocked" ? " dayrow--blocked" :
          state === "vacant" ? " dayrow--vacant" : "";

        const room = (
          <div className="dayrow__room">
            <div className="dayrow__num">{r.label}</div>
            <div className="dayrow__type">{r.roomTypeName.split(" ")[0]}</div>
          </div>
        );
        const body = (
          <div className="dayrow__body">
            {state === "vacant" && <span>Vacant</span>}
            {state === "blocked" && (
              <span style={{ fontStyle: "italic", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                Blocked{c?.blockReason ? ` · ${c.blockReason}` : ""}
              </span>
            )}
            {(state === "occupied" || state === "conflict") && (
              <>
                <div className="dayrow__guest">{state === "conflict" ? "Booking conflict" : c?.reservation?.guestName}</div>
                <div className="dayrow__tags">
                  {state === "occupied" && c?.reservation && <ChannelBadge name={c.reservation.channelName} />}
                  {c?.arriving && <span className="miniflag miniflag--arr"><Icon name="arrowDown" size={11} /> ARRIVES</span>}
                  {c?.departing && <span className="miniflag miniflag--dep"><Icon name="arrowUp" size={11} /> DEPARTS</span>}
                  {state === "conflict" && <span className="miniflag" style={{ background: "var(--red)", color: "#fff" }}>RESOLVE</span>}
                </div>
              </>
            )}
          </div>
        );

        if (state === "conflict") {
          return (
            <Link key={r.id} href="/conflicts" className="dayrow dayrow--conflict">
              {room}{body}
              <Icon name="chevronR" size={16} style={{ color: "var(--red-text)", flex: "none" }} />
            </Link>
          );
        }
        if (state === "occupied" && c?.reservation) {
          return (
            <Link key={r.id} href={`/reservations/${c.reservation.id}`} className="dayrow">
              {room}{body}
              <Icon name="chevronR" size={16} style={{ color: "var(--text-faint)", flex: "none" }} />
            </Link>
          );
        }
        return (
          <div key={r.id} className={`dayrow${cls}`}>
            {room}{body}
          </div>
        );
      })}
    </>
  );
}

function GridView({ dates, rows, today }: { dates: string[]; rows: Row[]; today: string }) {
  return (
    <>
      <div className="calgrid-wrap">
        <table className="calgrid">
          <thead>
            <tr>
              <th className="roomcol">Room</th>
              {dates.map((d) => {
                const p = dParts(d);
                return (
                  <th key={d} className={d === today ? "today" : ""}>{p.dow}<br />{p.day} {p.mon}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="roomcell"><span className="n">{r.label}</span><br /><span className="t">{r.roomTypeName.split(" ")[0]}</span></td>
                {r.cells.map((c, i) => {
                  const cls =
                    c.state === "occupied" ? "calcell--occ" :
                    c.state === "conflict" ? "calcell--conflict" :
                    c.state === "blocked" ? "calcell--blocked" : "";
                  const inner = (
                    <>
                      {c.arriving && <span className="cal-arr" />}
                      {c.departing && <span className="cal-dep" />}
                      {c.state === "occupied" && c.reservation && (
                        <span className="g"><span className="cdot" style={{ background: CH_DOT[c.reservation.channelName] ?? "var(--accent)" }} />{c.reservation.guestName}</span>
                      )}
                      {c.state === "conflict" && <span className="g">Conflict</span>}
                    </>
                  );
                  if (c.state === "occupied" && c.reservation) {
                    return (
                      <td key={i} className={`calcell ${cls}`}>
                        <Link href={`/reservations/${c.reservation.id}`} style={{ position: "absolute", inset: 0, padding: "6px 7px" }}>{inner}</Link>
                      </td>
                    );
                  }
                  if (c.state === "conflict") {
                    return (
                      <td key={i} className={`calcell ${cls}`}>
                        <Link href="/conflicts" style={{ position: "absolute", inset: 0, padding: "6px 7px" }}>{inner}</Link>
                      </td>
                    );
                  }
                  return <td key={i} className={`calcell ${cls}`}>{inner}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--accent-bg)" }} />Occupied</span>
        <span><i style={{ background: "var(--surface-3)" }} />Vacant</span>
        <span><i style={{ background: "repeating-linear-gradient(135deg, var(--blocked-bg), var(--blocked-bg) 3px, var(--blocked-line) 3px, var(--blocked-line) 6px)" }} />Blocked</span>
        <span><i style={{ background: "var(--red)" }} />Conflict</span>
        <span><i style={{ background: "var(--green)", width: 4 }} />Arrives</span>
        <span><i style={{ background: "var(--orange)", width: 4 }} />Departs</span>
      </div>
    </>
  );
}
