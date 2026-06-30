/* redesign/screen-reservation.jsx — New booking form (error-preventing: only free rooms)
   + Reservation detail (contextual hero action, payments). */
var { useState: useStateRes } = React;
var CH_DOT = window.CH_DOT;

function NewReservation({ go }) {
  const [channel, setChannel] = useStateRes("Direct");
  const [room, setRoom] = useStateRes("101");
  const [mode, setMode] = useStateRes("UPI");
  const [phone, setPhone] = useStateRes("");
  const [checkin, setCheckin] = useStateRes("2026-06-30");
  const [checkout, setCheckout] = useStateRes("2026-07-02");
  const [foreign, setForeign] = useStateRes(false);
  // rooms free for the selected dates (102 has the conflict, 103/301 booked across these dates)
  const freeRooms = { "101": true, "102": false, "103": true, "201": true, "202": false, "301": true };
  const nights = Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 86400000)) || 1;
  const digits = (s) => s.replace(/\D/g, "");
  const flagged = digits(phone).length >= 6 && DATA.flaggedNumbers.find((f) => digits(f.phone).endsWith(digits(phone).slice(-7)) || digits(phone).endsWith(digits(f.phone).slice(-7)));

  return (
    <div className="entrance">
      <a className="backlink" onClick={() => go("bookings")}><RDIcon name="chevronL" size={15} /> Cancel</a>
      <div className="display" style={{ marginBottom: 16 }}>New booking</div>

      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Guest</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="field">
          <label className="field-label">Phone <span className="req">*</span></label>
          <input className="input" placeholder="+91 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {flagged
            ? <div className="field-error" style={{ display: "flex", alignItems: "center", gap: 5 }}><RDIcon name="ban" size={13} /> On the scam list — {flagged.reason}.</div>
            : <div className="field-hint">We’ll match an existing guest as you type.</div>}
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Full name <span className="req">*</span></label>
          <input className="input" placeholder="e.g. Priya Nair" defaultValue="" />
        </div>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
          <div><div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "var(--fs-small)" }}>Foreign national</div><div className="field-hint" style={{ marginTop: 1 }}>Collect C-Form registration details</div></div>
          <button className={"switch" + (foreign ? " on" : "")} onClick={() => setForeign(!foreign)} aria-label="Foreign national"><span /></button>
        </div>
      </div>

      {foreign && (
        <div className="card card--pad" style={{ marginBottom: 18, borderColor: "var(--accent)" }}>
          <div className="eyebrow eyebrow--accent" style={{ marginBottom: 10 }}>C-Form · foreign-national registration</div>
          <div className="form-grid">
            <div className="field"><label className="field-label">Nationality</label><input className="input" placeholder="e.g. British" /></div>
            <div className="field"><label className="field-label">Passport no.</label><input className="input" placeholder="—" /></div>
            <div className="field"><label className="field-label">Date of entry</label><input className="input" type="date" /></div>
            <div className="field"><label className="field-label">Port of entry</label><input className="input" placeholder="e.g. Delhi" /></div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Purpose of visit</label><input className="input" placeholder="Tourism" /></div>
        </div>
      )}

      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Stay</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-in</label>
            <input className="input" type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-out</label>
            <input className="input" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
          </div>
        </div>
        <div className="field-hint" style={{ marginBottom: 14 }}>{nights} night{nights === 1 ? "" : "s"}</div>
        <label className="field-label">Room <span className="req">*</span></label>
        <div className="chips">
          {DATA.rooms.map((r) => {
            const free = freeRooms[r.id];
            return (
              <button key={r.id} className={"chip" + (room === r.id && free ? " on" : "")}
                disabled={!free} onClick={() => free && setRoom(r.id)}>
                {r.label} <span className="chip__sub">{r.type.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        <div className="field-hint">Only rooms free for these dates are selectable — no overlaps possible.</div>
      </div>

      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Channel</div>
      <div className="chips" style={{ marginBottom: 18 }}>
        {Object.keys(DATA.CH).map((c) => (
          <button key={c} className={"chip" + (channel === c ? " on" : "")} onClick={() => setChannel(c)}>
            <span className="dot" style={{ background: channel === c ? "#fff" : CH_DOT[c] }} />{c}
          </button>
        ))}
      </div>

      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>Details &amp; payment</div>
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Arrival time</label>
            <input className="input" type="time" defaultValue="14:00" />
          </div>
          <div className="field">
            <label className="field-label">Amount</label>
            <input className="input num" defaultValue="₹9,000" />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Payment mode</label>
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option>UPI</option><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Collected by OTA</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Special requests</label>
          <textarea className="textarea" placeholder="Late check-in, extra bed…"></textarea>
        </div>
      </div>

      <button className="btn btn--primary btn--block" disabled={!!flagged} style={{ marginBottom: 6 }}><RDIcon name="check" size={16} /> Save booking</button>
      <div className="field-hint" style={{ textAlign: "center" }}>{flagged ? "Resolve the scam-list warning to continue." : nights + " night" + (nights === 1 ? "" : "s") + " · Room " + room + " · " + channel}</div>
    </div>
  );
}

function ReservationDetail({ go }) {
  const r = DATA.reservation;
  const pct = Math.round((r.collected / r.amount) * 100);
  const due = r.amount - r.collected;
  return (
    <div className="entrance">
      <a className="backlink" onClick={() => go("today")}><RDIcon name="chevronL" size={15} /> Back</a>

      <div className="row" style={{ gap: 13, marginBottom: 14 }}>
        <span className="avatar">{r.name.split(" ").map((w) => w[0]).join("")}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="h2" style={{ fontSize: 20 }}>{r.name}</span>
            <StatusBadge kind="good"><span className="dot" />{r.status}</StatusBadge>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{r.phone}</span>
            <ChannelBadge name={r.channel} />
          </div>
        </div>
      </div>

      <div className="card card--pad" style={{ marginBottom: 14 }}>
        <div className="spread" style={{ marginBottom: 10 }}>
          <div><div className="eyebrow">Room</div><div className="h3" style={{ marginTop: 3 }}>{r.room} · {r.type}</div></div>
          <div style={{ textAlign: "right" }}><div className="eyebrow">Amount</div><div className="h3 money" style={{ marginTop: 3, fontSize: 18 }}>{DATA.money(r.amount)}</div></div>
        </div>
        <hr className="hairline" style={{ margin: "12px 0" }} />
        <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
          <div><div className="eyebrow">Check-in</div><div style={{ fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{r.checkin}</div></div>
          <div><div className="eyebrow">Check-out</div><div style={{ fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{r.checkout}</div></div>
          <div><div className="eyebrow">Nights</div><div style={{ fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{r.nights}</div></div>
          <div><div className="eyebrow">Arrival</div><div style={{ fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{r.arrival}</div></div>
        </div>
        {r.requests && <><hr className="hairline" style={{ margin: "12px 0" }} /><div className="eyebrow">Special requests</div><div style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>{r.requests}</div></>}
        <hr className="hairline" style={{ margin: "12px 0" }} />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="eyebrow">Registration</div>
          <StatusBadge kind="good"><RDIcon name="check" size={11} /> ID on file</StatusBadge>
        </div>
      </div>

      {/* contextual hero action */}
      <button className="btn btn--primary btn--block" style={{ marginBottom: 10 }}><RDIcon name="arrowDown" size={17} /> Check in guest</button>
      <button className="btn btn--ghost btn--block" style={{ marginBottom: 14 }} onClick={() => go("messages")}><RDIcon name="inbox" size={16} /> Message guest</button>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-hdr"><div className="spread"><h3>Payments</h3>
          <StatusBadge kind="warn">{DATA.money(due) + " due"}</StatusBadge></div></div>
        <div className="card-body">
          <div className="spread" style={{ marginBottom: 7, fontSize: "var(--fs-meta)" }}>
            <span className="muted">Collected {DATA.money(r.collected)} of {DATA.money(r.amount)}</span><span className="money">{pct}%</span>
          </div>
          <div className="progress" style={{ marginBottom: 14 }}><div className="progress__fill progress__fill--warn" style={{ width: pct + "%" }} /></div>
          {r.payments.map((p, i) => (
            <div key={i} className="spread" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
              <span style={{ fontSize: "var(--fs-small)" }}><b className="num" style={{ color: "var(--ink)" }}>{DATA.money(p.amt)}</b> · {p.mode}</span>
              <span className="faint" style={{ fontSize: "var(--fs-meta)" }}>{p.date}</span>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }}><RDIcon name="plus" size={15} /> Add payment</button>
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => go("new")}><RDIcon name="edit" size={15} /> Edit</button>
        <button className="btn btn--ghost" style={{ flex: 1 }}><RDIcon name="receipt" size={15} /> Invoice</button>
        <button className="btn btn--danger btn--sm"><RDIcon name="ban" size={15} /></button>
      </div>
    </div>
  );
}
window.NewReservation = NewReservation;
window.ReservationDetail = ReservationDetail;
