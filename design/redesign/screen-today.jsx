/* redesign/screen-today.jsx — Today: needs-you banner (conflicts+escalations merged)
   → compact actions-first stat strip → arrivals → promoted housekeeping → departures
   → collapsed in-house / next 7. */
var { useState: useStateToday } = React;

function StatStrip() {
  const k = DATA.kpis;
  return (
    <div className="kpi-strip kpi-strip--3">
      <div className="kpi-panel kpi-panel--verdict">
        <div className="kpi-eyebrow">Occupancy</div>
        <div className="kpi-num">{k.occupancy}%</div>
        <div className="kpi-ctx">{k.occRooms}</div>
      </div>
      <div className="kpi-panel">
        <div className="kpi-eyebrow">Arrivals</div>
        <div className="kpi-num">{DATA.checkins.length}</div>
        <div className="kpi-ctx">today</div>
      </div>
      <div className="kpi-panel">
        <div className="kpi-eyebrow">Departures</div>
        <div className="kpi-num">{DATA.checkouts.length}</div>
        <div className="kpi-ctx">today</div>
      </div>
    </div>
  );
}

function PayBadge({ r }) {
  if (r.pay === "paid") return <StatusBadge kind="good">Paid</StatusBadge>;
  if (r.pay) return <StatusBadge kind="warn">{r.pay}</StatusBadge>;
  return null;
}

function StayRow({ r, go }) {
  return (
    <a className="rowcard" onClick={() => go("reservation", { id: r.id })}>
      {r.time && <span className="rowcard__time">{r.time}</span>}
      <div className="rowcard__main">
        <div className="rowcard__name">{r.name}</div>
        <div className="rowcard__meta">Room {r.room} · {r.type}</div>
      </div>
      <div className="rowcard__right">
        <ChannelBadge name={r.channel} />
        <PayBadge r={r} />
      </div>
    </a>
  );
}

function Today({ go }) {
  const [openInhouse, setOpenInhouse] = useStateToday(false);
  const needs = DATA.conflict ? 1 : 0;
  const totalNeeds = needs + DATA.escalations.length;

  // arrivals with sample payment state
  const arrivals = DATA.checkins.map((r, i) => ({ ...r, pay: i === 1 ? "paid" : (i === 0 ? "₹2,000 due" : "₹10,000 due") }));
  const departures = DATA.checkouts.map((r) => ({ ...r, pay: "paid" }));

  return (
    <div className="entrance">
      <div className="pagehead">
        <div className="display">Today</div>
        <div className="pagehead__sub">Monday, 30 June 2026</div>
      </div>

      {totalNeeds > 0 && (
        <a className="banner banner--danger" onClick={() => go("needsyou")}>
          <span className="banner__icon"><RDIcon name="alert" size={18} /></span>
          <span className="banner__txt"><b>{totalNeeds} things need you</b> — {needs} booking conflict, {DATA.escalations.length} approval</span>
          <span className="banner__arrow"><RDIcon name="arrowR" size={17} /></span>
        </a>
      )}

      <div style={{ height: 14 }} />
      <StatStrip />

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Arrivals today</span>
          <span className="section-label__c">{arrivals.length}</span>
        </div>
      </div>
      {arrivals.map((r) => <StayRow key={r.id} r={r} go={go} />)}

      {/* Promoted housekeeping — the morning routine, on the dashboard */}
      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">To clean</span>
          <span className="section-label__c">{DATA.toClean.length}</span>
        </div>
        <a className="section-label__a" onClick={() => go("housekeeping")}>Housekeeping <RDIcon name="arrowR" size={13} /></a>
      </div>
      <div className="card card--pad clean-card">
        <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>Clean before tonight’s arrivals.</div>
        <div className="room-chips">
          {DATA.toClean.map((c) => (
            <div key={c.room} className={"room-chip" + (c.priority ? " room-chip--prio" : "")}>
              <b>{c.room}</b>
              <small>{c.priority ? "Arriving soon" : "Checked out"}</small>
            </div>
          ))}
        </div>
        <button className="btn btn--primary btn--block" style={{ marginTop: 12 }} onClick={() => go("housekeeping")}>
          <RDIcon name="check" size={16} /> Mark a room clean
        </button>
      </div>

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Departures today</span>
          <span className="section-label__c">{departures.length}</span>
        </div>
      </div>
      {departures.map((r) => <StayRow key={r.id} r={r} go={go} />)}

      <button className="section-label" style={{ width: "100%", background: "none", border: 0, cursor: "pointer" }}
        onClick={() => setOpenInhouse((v) => !v)}>
        <div className="section-label__l">
          <span className="section-label__t">In-house now</span>
          <span className="section-label__c">{DATA.inhouse.length}</span>
        </div>
        <span className="section-label__a">{openInhouse ? "Hide" : "Show"}
          <RDIcon name={openInhouse ? "arrowUp" : "arrowDown"} size={14} /></span>
      </button>
      {openInhouse && DATA.inhouse.map((r, i) => <StayRow key={i} r={r} go={go} />)}

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Next 7 days</span>
          <span className="section-label__c">{DATA.upcoming.length}</span>
        </div>
        <a className="section-label__a" onClick={() => go("calendar")}>Calendar <RDIcon name="arrowR" size={13} /></a>
      </div>
      {DATA.upcoming.slice(0, 3).map((r, i) => (
        <a key={i} className="rowcard" onClick={() => go("reservation", { id: r.id })}>
          <div className="rowcard__main">
            <div className="rowcard__name">{r.name}</div>
            <div className="rowcard__meta">Room {r.room} · {r.type}</div>
          </div>
          <div className="rowcard__right">
            <ChannelBadge name={r.channel} />
            <span className="rowcard__time">{r.date}</span>
          </div>
        </a>
      ))}
    </div>
  );
}
window.Today = Today;
