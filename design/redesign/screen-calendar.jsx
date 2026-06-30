/* redesign/screen-calendar.jsx — Calendar with Day (default on phone) + Grid views.
   Day = glanceable per-day room list; Grid = rooms × dates overview. Conflict loud red in both. */
var { useState: useStateCal } = React;
var CH_DOT = window.CH_DOT;

function DayView({ sel, setSel, go }) {
  const booked = DATA.rooms.filter((r) => DATA.grid[r.id][sel].s === "occ").length;
  const pct = Math.round((booked / DATA.rooms.length) * 100);
  return (
    <>
      <div className="daystrip">
        {DATA.days.map((d, i) => (
          <a key={i} className={"daycell" + (i === sel ? " on" : "")} onClick={() => setSel(i)}>
            <div className="daycell__dow">{DATA.dows[i]}</div>
            <div className="daycell__d">{d}</div>
            {DATA.rooms.some((r) => { const c = DATA.grid[r.id][i]; return c.s === "occ" || c.s === "conflict"; }) && <div className="daycell__dot" />}
          </a>
        ))}
      </div>
      <div style={{ margin: "6px 2px 12px" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span className="h3">{DATA.dows[sel]} {DATA.days[sel]} Jun</span>
          <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{booked} of {DATA.rooms.length} booked · {DATA.rooms.length - booked} free</span>
        </div>
        <div className="progress"><div className="progress__fill" style={{ width: pct + "%" }} /></div>
      </div>

      {DATA.rooms.map((r) => {
        const c = DATA.grid[r.id][sel];
        const cls = c.s === "conflict" ? " dayrow--conflict" : c.s === "blocked" ? " dayrow--blocked" : c.s === "vacant" ? " dayrow--vacant" : "";
        return (
          <a key={r.id} className={"dayrow" + cls} onClick={() => c.s === "conflict" ? go("conflicts") : c.s === "occ" ? go("reservation", { id: r.id }) : c.s === "vacant" ? go("new") : null}>
            <div className="dayrow__room">
              <div className="dayrow__num">{r.label}</div>
              <div className="dayrow__type">{r.type.split(" ")[0]}</div>
            </div>
            <div className="dayrow__body">
              {c.s === "vacant" && <span>Vacant</span>}
              {c.s === "blocked" && <span style={{ fontStyle: "italic", color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>Blocked · maintenance</span>}
              {(c.s === "occ" || c.s === "conflict") && (
                <>
                  <div className="dayrow__guest">{c.s === "conflict" ? "Booking conflict" : c.g}</div>
                  <div className="dayrow__tags">
                    {c.s === "occ" && <ChannelBadge name={c.ch} />}
                    {c.arr && <span className="miniflag miniflag--arr"><RDIcon name="arrowDown" size={11} /> ARRIVES</span>}
                    {c.dep && <span className="miniflag miniflag--dep"><RDIcon name="arrowUp" size={11} /> DEPARTS</span>}
                    {c.s === "conflict" && <span className="miniflag" style={{ background: "var(--red)", color: "#fff" }}>RESOLVE</span>}
                  </div>
                </>
              )}
            </div>
            {(c.s === "occ" || c.s === "conflict") && <RDIcon name="chevronR" size={16} style={{ color: "var(--text-faint)", flex: "none" }} />}
            {c.s === "vacant" && <span className="daybook"><RDIcon name="plus" size={13} /> Book</span>}
          </a>
        );
      })}
    </>
  );
}

function GridView({ go }) {
  return (
    <>
      <div className="calgrid-wrap">
        <table className="calgrid">
          <thead>
            <tr>
              <th className="roomcol">Room</th>
              {DATA.days.map((d, i) => (
                <th key={i} className={i === 0 ? "today" : ""}>{DATA.dows[i]}<br />{d} Jun</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA.rooms.map((r) => (
              <tr key={r.id}>
                <td className="roomcell"><span className="n">{r.label}</span><br /><span className="t">{r.type.split(" ")[0]}</span></td>
                {DATA.grid[r.id].map((c, i) => {
                  const cls = c.s === "occ" ? "calcell--occ" : c.s === "conflict" ? "calcell--conflict" : c.s === "blocked" ? "calcell--blocked" : "";
                  return (
                    <td key={i} className={"calcell " + cls}
                      onClick={() => c.s === "conflict" ? go("conflicts") : c.s === "occ" ? go("reservation", { id: r.id }) : null}
                      style={{ cursor: c.s === "occ" || c.s === "conflict" ? "pointer" : "default" }}>
                      {c.arr && <span className="cal-arr" />}
                      {c.dep && <span className="cal-dep" />}
                      {(c.s === "occ") && <span className="g"><span className="cdot" style={{ background: CH_DOT[c.ch] }} />{c.g}</span>}
                      {c.s === "conflict" && <span className="g">Conflict</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--accent-bg)" }} />Occupied</span>
        <span><i style={{ background: "var(--surface-3)" }} />Vacant</span>
        <span><i style={{ background: "var(--red)" }} />Conflict</span>
        <span><i style={{ background: "var(--green)", width: 4 }} />Arrives</span>
        <span><i style={{ background: "var(--orange)", width: 4 }} />Departs</span>
      </div>
    </>
  );
}

function Calendar({ go, defaultView }) {
  const [view, setView] = useStateCal(defaultView || "day");
  const [sel, setSel] = useStateCal(0);
  return (
    <div className="entrance">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div className="display">Calendar</div>
          <div className="pagehead__sub">June 2026 · 6 rooms</div>
        </div>
        <div className="seg">
          <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}>Day</button>
          <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}>Grid</button>
        </div>
      </div>
      {view === "day" ? <DayView sel={sel} setSel={setSel} go={go} /> : <GridView go={go} />}
      <div style={{ height: 14 }} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => go("new")}><RDIcon name="plus" size={16} /> New booking</button>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => go("settings")}><RDIcon name="ban" size={16} /> Block a room</button>
      </div>
    </div>
  );
}
window.Calendar = Calendar;
