/* redesign/screen-more.jsx — the IA consolidation surfaces:
   MoreHub (grouped, not a wall), Bookings (searchable), NeedsYou (conflicts+escalations
   merged), Messages, Inbox. */
var { useState: useStateMore } = React;

/* ---------------- More hub ---------------- */
const MORE_GROUPS = [
  { label: "Operate", items: [
    { id: "guests", icon: "guests", t: "Guests", d: "Directory & lookup" },
    { id: "housekeeping", icon: "clean", t: "Cleaning", d: "2 rooms to clean" },
    { id: "needsyou", icon: "alert", t: "Needs you", d: "Conflicts & approvals", badge: 2 },
  ]},
  { label: "Business", items: [
    { id: "finance", icon: "wallet", t: "Finance", d: "Revenue & balances" },
    { id: "pricing", icon: "tag", t: "Pricing", d: "Advisory rates" },
    { id: "analytics", icon: "chart", t: "Analytics", d: "Occupancy & ADR" },
  ]},
  { label: "Review", items: [
    { id: "inbox", icon: "inbox", t: "Inbox", d: "2 OTA emails to confirm" },
    { id: "messages", icon: "inbox", t: "Messages", d: "Guest message log" },
  ]},
  { label: "Setup", items: [
    { id: "settings", icon: "settings", t: "Property setup", d: "Rooms, channels, pricing, blocked dates, scam list, sync" },
  ]},
];

function MoreHub({ go }) {
  return (
    <div className="entrance">
      <div className="pagehead">
        <div className="display">More</div>
        <div className="pagehead__sub">Everything else — grouped, not a wall of links</div>
      </div>
      <div className="dsearch" style={{ background: "var(--surface)", marginBottom: 8 }}>
        <RDIcon name="search" size={16} /><input placeholder="Search guests & bookings" />
      </div>

      {MORE_GROUPS.map((g) => (
        <div key={g.label} className="setgroup">
          <div className="setgroup__label">{g.label}</div>
          <div className="setlist">
            {g.items.map((it) => (
              <a key={it.id} className="setrow" onClick={() => go(it.id)}>
                <span className="setrow__ic"><RDIcon name={it.icon} size={17} /></span>
                <span className="setrow__main">
                  <span className="setrow__t">{it.t}</span>
                  <span className="setrow__d">{it.d}</span>
                </span>
                {it.badge && <span className="navitem__badge" style={{ marginRight: 8 }}>{it.badge}</span>}
                <RDIcon name="chevronR" size={17} className="setrow__chev" style={{ color: "var(--text-faint)" }} />
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="setgroup">
        <div className="setgroup__label">System</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--ghost" style={{ flex: 1 }}><RDIcon name="help" size={15} /> Help</button>
          <button className="btn btn--ghost" style={{ flex: 1 }}><RDIcon name="settings" size={15} /> Preferences</button>
          <button className="btn btn--ghost" style={{ flex: 1 }}><RDIcon name="logout" size={15} /> Log out</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Bookings (searchable + filterable list) ---------------- */
const STATUS_KIND = { Arrives: "good", Departs: "warn", Staying: "teal", Upcoming: "neutral" };
const BK_FILTERS = [
  { key: "all", label: "All" },
  { key: "Arrives", label: "Arrivals" },
  { key: "Staying", label: "In-house" },
  { key: "Upcoming", label: "Upcoming" },
  { key: "Departs", label: "Departures" },
];
function Bookings({ go }) {
  const [q, setQ] = useStateMore("");
  const [filter, setFilter] = useStateMore("all");
  const counts = DATA.bookings.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  const list = DATA.bookings.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return r.name.toLowerCase().includes(s) || r.room.includes(s) || r.channel.toLowerCase().includes(s);
  });
  return (
    <div className="entrance">
      <div className="pagehead">
        <div className="display">Bookings</div>
        <div className="pagehead__sub">{DATA.bookings.length} reservations — search or filter</div>
      </div>
      <div className="dsearch" style={{ background: "var(--surface)", marginBottom: 12 }}>
        <RDIcon name="search" size={16} />
        <input placeholder="Search guest, room or channel" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="iconbtn" style={{ width: 26, height: 26, border: 0, background: "transparent" }} onClick={() => setQ("")} aria-label="Clear"><RDIcon name="x" size={15} /></button>}
      </div>
      <div className="chips" style={{ marginBottom: 14, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
        {BK_FILTERS.map((f) => (
          <button key={f.key} className={"chip" + (filter === f.key ? " on" : "")} style={{ flex: "none", padding: "7px 12px" }} onClick={() => setFilter(f.key)}>
            {f.label}{f.key !== "all" && counts[f.key] ? <span className="chip__sub">{counts[f.key]}</span> : null}
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <div className="empty">
          {q ? <>No bookings match “{q}”.</> : <>No {BK_FILTERS.find((f) => f.key === filter).label.toLowerCase()} right now.</>}
        </div>
      )}
      {list.map((r, i) => (
        <a key={i} className="rowcard" onClick={() => go("reservation", { id: r.id })}>
          <span className="rowcard__lead">{r.name.split(" ").map((w) => w[0]).join("")}</span>
          <div className="rowcard__main">
            <div className="rowcard__name">{r.name}</div>
            <div className="rowcard__meta">Room {r.room} · {r.type}</div>
          </div>
          <div className="rowcard__right">
            <ChannelBadge name={r.channel} />
            <StatusBadge kind={STATUS_KIND[r.status] || "neutral"}>{r.status} · {r.when}</StatusBadge>
          </div>
        </a>
      ))}
    </div>
  );
}

/* ---------------- Needs you (conflicts + escalations merged) ---------------- */
function NeedsYou({ go }) {
  const c = DATA.conflict;
  return (
    <div className="entrance">
      <a className="backlink" onClick={() => go("today")}><RDIcon name="chevronL" size={15} /> Today</a>
      <div className="pagehead">
        <div className="display">Needs you</div>
        <div className="pagehead__sub">Decisions only you can make — booking conflicts and approvals the assistant filed.</div>
      </div>

      <div className="setgroup__label" style={{ padding: "4px 4px 8px" }}>Booking conflicts · 1</div>
      <div className="card card--pad" style={{ borderColor: "var(--red-border)", background: "var(--red-bg)", marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <RDIcon name="alert" size={18} style={{ color: "var(--red-text)" }} />
          <span style={{ fontWeight: 700, color: "var(--red-text)" }}>Room {c.room} · overlap {c.overlap}</span>
        </div>
        <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>Booking: <b style={{ color: "var(--ink)" }}>{c.booking}</b></div>
        <div style={{ fontSize: "var(--fs-small)", color: "var(--text)", marginTop: 2 }}>Block: {c.block} <span className="faint">({c.source})</span></div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn--danger" style={{ flex: 1 }} onClick={() => go("reservation", { id: "r-priya" })}>Open reservation</button>
          <button className="btn btn--ghost" style={{ flex: 1 }}>Remove block</button>
        </div>
      </div>

      <div className="setgroup__label" style={{ padding: "4px 4px 8px" }}>Approvals · {DATA.escalations.length}</div>
      {DATA.escalations.map((e) => (
        <div key={e.id} className="card card--pad" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "var(--fs-small)" }}>{e.title}</span>
            <StatusBadge kind="warn">{e.severity}</StatusBadge>
          </div>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", marginBottom: 4 }}>From {e.from}</div>
          <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>{e.note}</div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => go("reservation", { id: e.resId })}>Review &amp; approve</button>
            <button className="btn btn--ghost" style={{ flex: 1 }}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Messages ---------------- */
function Messages({ go }) {
  return (
    <div className="entrance">
      <a className="backlink" onClick={() => go("more")}><RDIcon name="chevronL" size={15} /> More</a>
      <div className="pagehead">
        <div className="display">Messages</div>
        <div className="pagehead__sub">{DATA.messages.length} outbound message{DATA.messages.length === 1 ? "" : "s"}, logged for your review.</div>
      </div>
      {DATA.messages.length === 0 && <div className="empty">No messages logged yet.</div>}
      {DATA.messages.map((m) => (
        <div key={m.id} className="card card--pad" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "var(--fs-small)" }}>{m.to}</span>
            <div className="row" style={{ gap: 6 }}>
              <ChannelBadge name={m.channel === "WhatsApp" ? "WhatsApp" : "Direct"} />
              <StatusBadge kind="neutral">{m.status}</StatusBadge>
            </div>
          </div>
          <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>{m.body}</div>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-faint)", marginTop: 6 }}>{m.when}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Inbox ---------------- */
function Inbox({ go }) {
  return (
    <div className="entrance">
      <a className="backlink" onClick={() => go("more")}><RDIcon name="chevronL" size={15} /> More</a>
      <div className="pagehead">
        <div className="display">Inbox</div>
        <div className="pagehead__sub">{DATA.inbox.length} OTA confirmation{DATA.inbox.length === 1 ? "" : "s"} staged for you to confirm into bookings.</div>
      </div>
      {DATA.inbox.length === 0 && <div className="empty">Nothing waiting. Forwarded OTA emails land here.</div>}
      {DATA.inbox.map((it) => (
        <div key={it.id} className="card card--pad" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "var(--fs-small)" }}>{it.guest}</span>
            <ChannelBadge name={it.channel} />
          </div>
          <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>{it.room} · {it.dates}</div>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-faint)", marginTop: 4 }}>Ref {it.ref}</div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => go("new")}>Confirm booking</button>
            <button className="btn btn--ghost" style={{ flex: 1 }}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { MoreHub, Bookings, NeedsYou, Messages, Inbox });
