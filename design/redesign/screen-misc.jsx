/* redesign/screen-misc.jsx — secondary screens so every nav target resolves:
   Housekeeping, Conflicts, Finance, Guests, and a Generic stub for Phase-2+ pages. */

function Housekeeping({ go }) {
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>Cleaning</div>
      <div className="pagehead__sub" style={{ marginBottom: 16 }}>2 rooms to clean.</div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">To clean</span><span className="section-label__c">2</span></div></div>
      {DATA.toClean.map((r) => (
        <div key={r.room} className={"rowcard" + (r.priority ? "" : "")} style={r.priority ? { borderColor: "var(--red-border)", background: "var(--red-bg)" } : null}>
          <div className="rowcard__main">
            <div className="rowcard__name">Room {r.room} <span className="muted" style={{ fontWeight: 500 }}>· {r.type}</span></div>
            <div className="rowcard__tags dayrow__tags" style={{ marginTop: 6 }}>
              {r.priority && <span className="miniflag" style={{ background: "var(--red)", color: "#fff" }}>ARRIVING — CLEAN FIRST</span>}
              {r.tags.includes("occupied") && <StatusBadge kind="sent">Occupied tonight</StatusBadge>}
              <span className="faint" style={{ fontSize: "var(--fs-meta)" }}>{r.note}</span>
            </div>
          </div>
          <button className="btn btn--success btn--sm"><RDIcon name="check" size={15} /> Clean</button>
        </div>
      ))}

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">Ready</span><span className="section-label__c">4</span></div></div>
      {[{ r: "201", t: "Deluxe", tag: "Occupied tonight" }, { r: "301", t: "Family Suite", tag: "Arrival today" }, { r: "101", t: "Standard Double", tag: "Occupied tonight" }, { r: "102", t: "Standard Double", tag: "Arrival today" }].map((x) => (
        <div key={x.r} className="rowcard">
          <div className="rowcard__main">
            <div className="rowcard__name">Room {x.r} <span className="muted" style={{ fontWeight: 500 }}>· {x.t}</span></div>
            <div style={{ marginTop: 6 }}><StatusBadge kind="neutral">{x.tag}</StatusBadge></div>
          </div>
          <button className="btn btn--ghost btn--sm">Needs cleaning</button>
        </div>
      ))}
    </div>
  );
}

function Conflicts({ go }) {
  const c = DATA.conflict;
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>Conflicts</div>
      <div className="pagehead__sub" style={{ marginBottom: 16 }}>Rooms both booked and blocked on the same nights. Resolve by editing the reservation or removing the block.</div>
      <div className="card card--pad" style={{ borderColor: "var(--red-border)", background: "var(--red-bg)" }}>
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
    </div>
  );
}

function Finance({ go }) {
  const f = DATA.finance;
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>Finance</div>
      <div className="pagehead__sub" style={{ marginBottom: 16 }}>1 Jun – 1 Jul 2026 · 7 bookings</div>
      <div className="kpi-strip" style={{ marginBottom: 18 }}>
        <div className="kpi-panel kpi-panel--verdict"><div className="kpi-eyebrow">Net to you</div><div className="kpi-num">{DATA.money(f.net)}</div><div className="kpi-ctx">after commission</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Gross</div><div className="kpi-num">{DATA.money(f.gross)}</div><div className="kpi-ctx">revenue</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Commission</div><div className="kpi-num">{DATA.money(f.commission)}</div><div className="kpi-ctx">to OTAs</div></div>
        <div className="kpi-panel"><div className="kpi-eyebrow">Outstanding</div><div className="kpi-num" style={{ color: "var(--amber-text)" }}>{DATA.money(f.outstanding)}</div><div className="kpi-ctx">unpaid balances</div></div>
      </div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">By channel</span></div></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Channel</th><th className="r">Bookings</th><th className="r">Gross</th><th className="r">Net</th></tr></thead>
          <tbody>
            {f.byChannel.map((row) => (
              <tr key={row.ch}>
                <td className="strong">{row.ch}</td>
                <td className="r num">{row.bookings}</td>
                <td className="r num">{DATA.money(row.gross)}</td>
                <td className="r money">{DATA.money(row.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-label"><div className="section-label__l"><span className="section-label__t">Balances due</span><span className="section-label__c">{f.balances.length}</span></div></div>
      {f.balances.map((b, i) => (
        <a key={i} className="rowcard" onClick={() => go("reservation", { id: "r-rohan" })}>
          <div className="rowcard__main"><div className="rowcard__name" style={{ fontSize: "var(--fs-small)" }}>{b.name} <span className="muted">· Room {b.room}</span></div></div>
          <span className="num" style={{ color: "var(--amber-text)", fontWeight: 700, fontSize: "var(--fs-small)" }}>{DATA.money(b.due)} due</span>
        </a>
      ))}
    </div>
  );
}

function Guests({ go }) {
  const all = [...new Map([...DATA.checkins, ...DATA.inhouse, ...DATA.upcoming, ...DATA.checkouts].map((g) => [g.name, g])).values()];
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 12 }}>Guests</div>
      <div className="dsearch" style={{ marginBottom: 16, background: "var(--surface)" }}>
        <RDIcon name="search" size={16} /><input placeholder="Search by name or phone" />
      </div>
      {all.map((g, i) => (
        <a key={i} className="rowcard" onClick={() => go("reservation", { id: g.id })}>
          <span className="rowcard__lead">{g.name.split(" ").map((w) => w[0]).join("")}</span>
          <div className="rowcard__main">
            <div className="rowcard__name">{g.name}</div>
            <div className="rowcard__meta">Room {g.room} · {g.type}</div>
          </div>
          <RDIcon name="chevronR" size={16} style={{ color: "var(--text-faint)" }} />
        </a>
      ))}
    </div>
  );
}

function GenericScreen({ title, sub, icon }) {
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 6 }}>{title}</div>
      <div className="pagehead__sub" style={{ marginBottom: 18 }}>{sub}</div>
      <div className="empty" style={{ padding: 40 }}>
        <div style={{ color: "var(--text-faint)", marginBottom: 10 }}><RDIcon name={icon} size={30} /></div>
        Redesigned to the same system — not part of the priority-flow mockups.
      </div>
    </div>
  );
}
Object.assign(window, { Housekeeping, Conflicts, Finance, Guests, GenericScreen });
