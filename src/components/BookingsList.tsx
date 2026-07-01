"use client";

import { useState } from "react";
import Link from "next/link";
import { ChannelBadge, StatusPill, Icon } from "@/components/ui";

// One reservation row, computed server-side. `bucket` is the coarse timeline used
// by the filter chips (Upcoming → In-house → Past, plus a Cancelled exceptions
// bucket); `state` is the finer label shown on the row badge (e.g. "Arrives today").
export type BookingBucket = "upcoming" | "in_house" | "past" | "cancelled";
export type BookingState = "arrives" | "departs" | "staying" | "upcoming" | "past" | "cancelled" | "no_show";

export type BookingRow = {
  id: string;
  name: string;
  phone: string;
  room: string;
  roomType: string;
  channel: string;
  dates: string;
  bucket: BookingBucket;
  state: BookingState;
  when: string;
};

const STATE_LABEL: Record<BookingState, string> = {
  arrives: "Arrives",
  departs: "Departs",
  staying: "In-house",
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
  no_show: "No-show",
};
const STATE_KIND: Record<BookingState, "good" | "warn" | "danger" | "ink" | "teal"> = {
  arrives: "good",
  departs: "warn",
  staying: "teal",
  upcoming: "ink",
  past: "ink",
  cancelled: "ink",
  no_show: "danger",
};

// One coherent timeline (Upcoming → In-house → Past) plus a Cancelled exceptions
// bucket (cancelled + no-show). Arrivals/departures stay on Today; here we favour
// a findable archive over transient today-only buckets.
const FILTERS: { key: string; label: string; match?: BookingBucket }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming", match: "upcoming" },
  { key: "in_house", label: "In-house", match: "in_house" },
  { key: "past", label: "Past", match: "past" },
  { key: "cancelled", label: "Cancelled", match: "cancelled" },
];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function BookingsList({ rows }: { rows: BookingRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = rows.reduce<Record<string, number>>((m, r) => {
    m[r.bucket] = (m[r.bucket] ?? 0) + 1;
    return m;
  }, {});

  const term = q.trim().toLowerCase();
  const list = rows.filter((r) => {
    const f = FILTERS.find((x) => x.key === filter);
    if (f?.match && r.bucket !== f.match) return false;
    if (!term) return true;
    return (
      r.name.toLowerCase().includes(term) ||
      r.phone.includes(term) ||
      r.room.toLowerCase().includes(term) ||
      r.channel.toLowerCase().includes(term)
    );
  });

  return (
    <>
      <div className="dsearch" style={{ background: "var(--surface)", marginBottom: 12 }}>
        <Icon name="search" size={16} />
        <input
          placeholder="Search guest, room or channel"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search bookings"
        />
        {q && (
          <button
            className="iconbtn"
            style={{ width: 26, height: 26, border: 0, background: "transparent" }}
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      <div className="chips" style={{ marginBottom: 14, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip${filter === f.key ? " on" : ""}`}
            style={{ flex: "none" }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.match && counts[f.match] ? <span className="chip__sub">{counts[f.match]}</span> : null}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          {term
            ? `No bookings match “${q}”.`
            : `No ${(FILTERS.find((f) => f.key === filter)?.label ?? "").toLowerCase()} right now.`}
        </div>
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {list.map((r) => (
            <Link key={r.id} href={`/reservations/${r.id}`} className="rowcard">
              <span className="rowcard__lead">{initials(r.name)}</span>
              <div className="rowcard__main">
                <div className="rowcard__name">{r.name}</div>
                <div className="rowcard__meta">Room {r.room} · {r.roomType} · {r.dates}</div>
              </div>
              <div className="rowcard__right">
                <ChannelBadge name={r.channel} />
                <StatusPill kind={STATE_KIND[r.state]}>
                  {STATE_LABEL[r.state]}{r.when ? ` · ${r.when}` : ""}
                </StatusPill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
