/* redesign/screen-today.jsx — Today: alerts → verdict KPI strip → arrivals/departures timeline → collapsible in-house → upcoming peek. */
var { useState: useStateToday } = React;

function KpiStrip() {
  const k = DATA.kpis;
  return (
    <div className="kpi-strip">
      <div className="kpi-panel kpi-panel--verdict">
        <div className="kpi-eyebrow">Occupancy</div>
        <div className="kpi-num">{k.occupancy}%</div>
        <div className="kpi-ctx">{k.occRooms}</div>
      </div>
      <div className="kpi-panel">
        <div className="kpi-eyebrow">In-house</div>
        <div className="kpi-num">{k.inhouse}</div>
        <div className="kpi-ctx">guests tonight</div>
      </div>
      <div className="kpi-panel">
        <div className="kpi-eyebrow">Check-ins</div>
        <div className="kpi-num">{k.checkins}</div>
        <div className="kpi-ctx">expected today</div>
      </div>
      <div className="kpi-panel">
        <div className="kpi-eyebrow">Check-outs</div>
        <div className="kpi-num">{k.checkouts}</div>
        <div className="kpi-ctx">leaving today</div>
      </div>
    </div>
  );
}

function ArrivalRow({ r, go }) {
  return (
    <a className="rowcard" onClick={() => go("reservation", { id: r.id })}>
      <span className="rowcard__time">{r.time || "—"}</span>
      <div className="rowcard__main">
        <div className="rowcard__name">{r.name}</div>
        <div className="rowcard__meta">Room {r.room} · {r.type}</div>
      </div>
      <div className="rowcard__right"><ChannelBadge name={r.channel} /></div>
    </a>
  );
}

function Today({ go }) {
  const [openInhouse, setOpenInhouse] = useStateToday(false);
  return (
    <div className="entrance">
      <div className="pagehead">
        <div className="display">Today</div>
        <div className="pagehead__sub">Monday, 1 June 2026</div>
      </div>

      <a className="banner banner--danger" onClick={() => go("conflicts")}>
        <span className="banner__icon"><RDIcon name="alert" size={18} /></span>
        <span className="banner__txt">1 booking conflict needs attention</span>
        <span className="banner__arrow"><RDIcon name="arrowR" size={17} /></span>
      </a>
      <a className="banner banner--warn" onClick={() => go("housekeeping")}>
        <span className="banner__icon"><RDIcon name="clean" size={18} /></span>
        <span className="banner__txt">2 rooms to clean</span>
        <span className="banner__arrow"><RDIcon name="arrowR" size={17} /></span>
      </a>

      <div style={{ height: 16 }} />
      <KpiStrip />

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Arrivals today</span>
          <span className="section-label__c">{DATA.checkins.length}</span>
        </div>
      </div>
      {DATA.checkins.map((r) => <ArrivalRow key={r.id} r={r} go={go} />)}

      <div className="section-label">
        <div className="section-label__l">
          <span className="section-label__t">Departures today</span>
          <span className="section-label__c">{DATA.checkouts.length}</span>
        </div>
      </div>
      {DATA.checkouts.map((r) => (
        <a key={r.id} className="rowcard" onClick={() => go("reservation", { id: r.id })}>
          <div className="rowcard__main">
            <div className="rowcard__name">{r.name}</div>
            <div className="rowcard__meta">Room {r.room} · {r.type}</div>
          </div>
          <div className="rowcard__right"><ChannelBadge name={r.channel} /></div>
        </a>
      ))}

      {/* In-house: collapsed by default — no longer duplicates arrivals on first glance */}
      <button className="section-label" style={{ width: "100%", background: "none", border: 0, cursor: "pointer" }}
        onClick={() => setOpenInhouse((v) => !v)}>
        <div className="section-label__l">
          <span className="section-label__t">In-house now</span>
          <span className="section-label__c">{DATA.inhouse.length}</span>
        </div>
        <span className="section-label__a">{openInhouse ? "Hide" : "Show"}
          <RDIcon name={openInhouse ? "arrowUp" : "arrowDown"} size={14} /></span>
      </button>
      {openInhouse && DATA.inhouse.map((r, i) => (
        <a key={i} className="rowcard" onClick={() => go("reservation", { id: r.id })}>
          <div className="rowcard__main">
            <div className="rowcard__name">{r.name}</div>
            <div className="rowcard__meta">Room {r.room} · {r.type}</div>
          </div>
          <div className="rowcard__right"><ChannelBadge name={r.channel} /></div>
        </a>
      ))}

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
window.KpiStrip = KpiStrip;
