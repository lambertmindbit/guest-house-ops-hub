/* redesign/screen-settings.jsx — Settings hub (grouped list) → drill-in sub-pages.
   Replaces the single-open accordion. Every section from the real SettingsClient
   is mocked as its own focused page. */
var { useState: useStateSet } = React;

const SET_GROUPS = [
  { label: "Property", items: [
    { id: "property", icon: "building", t: "Property details", d: "Name, address, times, GST, currency" },
  ]},
  { label: "Inventory", items: [
    { id: "roomtypes", icon: "bed", t: "Room types", d: "3 types · rates, occupancy, floor/ceiling" },
    { id: "rooms", icon: "door", t: "Rooms", d: "6 rooms · labels and type" },
  ]},
  { label: "Channels", items: [
    { id: "channels", icon: "link", t: "Channels", d: "5 sources · commission, payment" },
  ]},
  { label: "Pricing", items: [
    { id: "pricing", icon: "tag", t: "Pricing rules", d: "Weekend, season, lead-time, occupancy" },
  ]},
  { label: "Maintenance", items: [
    { id: "blocks", icon: "ban", t: "Blocked dates", d: "1 active block" },
  ]},
  { label: "Safety", items: [
    { id: "flagged", icon: "ban", t: "Scam numbers", d: "2 flagged numbers · warn at booking" },
  ]},
];
const SET_FLAT = SET_GROUPS.flatMap((g) => g.items);

/* ---------- shared sub-page header ---------- */
function SubHead({ back, title, sub, action }) {
  return (
    <>
      <a className="backlink" onClick={back}><RDIcon name="chevronL" size={15} /> Settings</a>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div className="display" style={{ marginBottom: sub ? 4 : 14 }}>{title}</div>
        {action}
      </div>
      {sub && <div className="pagehead__sub" style={{ marginBottom: 16 }}>{sub}</div>}
    </>
  );
}
function AddBtn({ children }) {
  return <button className="btn btn--ghost btn--sm" style={{ flex: "none" }}><RDIcon name="plus" size={14} /> {children}</button>;
}
/* consistent Edit + Delete cluster for manage rows */
function RowActions({ extra, showEdit = true, showDelete = true }) {
  return (
    <div className="row" style={{ gap: 6, flex: "none" }}>
      {extra}
      {showEdit && <button className="btn btn--ghost btn--icon btn--sm" title="Edit" aria-label="Edit"><RDIcon name="edit" size={15} /></button>}
      {showDelete && <button className="btn btn--danger btn--icon btn--sm" title="Delete" aria-label="Delete"><RDIcon name="trash" size={15} /></button>}
    </div>
  );
}

/* ---------- Hub ---------- */
function SettingsHub({ openSub }) {
  return (
    <div className="entrance">
      <div className="display" style={{ marginBottom: 16 }}>Settings</div>
      {SET_GROUPS.map((g) => (
        <div key={g.label} className="setgroup">
          <div className="setgroup__label">{g.label}</div>
          <div className="setlist">
            {g.items.map((it) => (
              <a key={it.id} className="setrow" onClick={() => openSub(it.id)}>
                <span className="setrow__ic"><RDIcon name={it.icon} size={17} /></span>
                <span className="setrow__main">
                  <span className="setrow__t">{it.t}</span>
                  <span className="setrow__d">{it.d}</span>
                </span>
                <RDIcon name="chevronR" size={17} className="setrow__chev" style={{ color: "var(--text-faint)" }} />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Property details ---------- */
function PropertyDetails({ back }) {
  const p = DATA.property;
  return (
    <div className="entrance">
      <SubHead back={back} title="Property details" />
      <div className="card card--pad">
        <div className="field">
          <label className="field-label">Property name <span className="req">*</span></label>
          <input className="input" defaultValue={p.name} />
        </div>
        <div className="field">
          <label className="field-label">Address</label>
          <input className="input" defaultValue={p.address} />
          <div className="field-hint">Used on printed invoices.</div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label className="field-label">Currency</label>
            <input className="input" defaultValue={p.currency} />
          </div>
          <div className="field">
            <label className="field-label">GST number</label>
            <input className="input" defaultValue={p.gst} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-in time</label>
            <input className="input" type="time" defaultValue={p.checkIn} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Check-out time</label>
            <input className="input" type="time" defaultValue={p.checkOut} />
          </div>
        </div>
      </div>
      <div className="field-hint" style={{ padding: "9px 4px 0" }}>Timezone <b style={{ color: "var(--ink)" }}>{p.timezone}</b> — used for “today”, arrivals and the calendar. Check-in / out times default onto every new booking.</div>
      <button className="btn btn--primary btn--block" style={{ marginTop: 14 }}>Save property</button>
    </div>
  );
}

/* ---------- Room types ---------- */
function RoomTypes({ back }) {
  return (
    <div className="entrance">
      <SubHead back={back} title="Room types" action={<AddBtn>Add type</AddBtn>} />
      <div className="col" style={{ gap: 10 }}>
        {DATA.roomTypes.map((t) => (
          <div key={t.id} className="card card--pad">
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div className="h3">{t.name}</div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <StatusBadge kind="paid">{DATA.money(t.base) + " base"}</StatusBadge>
                  <StatusBadge kind="neutral">{"Sleeps " + t.sleeps}</StatusBadge>
                  <StatusBadge kind="neutral">{t.rooms + " room" + (t.rooms === 1 ? "" : "s")}</StatusBadge>
                </div>
                <div className="field-hint" style={{ marginTop: 8 }}>Rate range {DATA.money(t.floor)} – {DATA.money(t.ceiling)}</div>
              </div>
              <RowActions />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Rooms ---------- */
function Rooms({ back }) {
  return (
    <div className="entrance">
      <SubHead back={back} title="Rooms" action={<AddBtn>Add room</AddBtn>} />
      <div className="col" style={{ gap: 8 }}>
        {DATA.roomList.map((r) => (
          <div key={r.label} className="rowcard" style={{ marginTop: 0 }}>
            <span className="rowcard__lead">{r.label}</span>
            <div className="rowcard__main">
              <div className="rowcard__name">Room {r.label}</div>
              <div className="rowcard__meta">{r.type}</div>
            </div>
            <RowActions showEdit={false} extra={<button className="btn btn--ghost btn--sm">Archive</button>} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Channels ---------- */
function ChannelsSubpage({ back }) {
  return (
    <div className="entrance">
      <SubHead back={back} title="Channels" sub="Commission and who collects payment for each booking source." action={<AddBtn>Add</AddBtn>} />
      <div className="col" style={{ gap: 8 }}>
        {DATA.channels.map((c) => (
          <div key={c.name} className="card card--pad">
            <div className="spread">
              <div className="row" style={{ gap: 10, minWidth: 0 }}>
                <span className="dot" style={{ width: 10, height: 10, borderRadius: "50%", flex: "none", background: window.CH_DOT[c.name] }} />
                <div style={{ minWidth: 0 }}>
                  <div className="rowcard__name">{c.name}</div>
                  <div className="rowcard__meta">{c.commission}% commission · {c.collects ? "collects payment" : "you collect"} · {c.bookings + " booking" + (c.bookings === 1 ? "" : "s")}</div>
                </div>
              </div>
              <RowActions />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Pricing rules ---------- */
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function Pricing({ back }) {
  const pr = DATA.pricing;
  const [on, setOn] = useStateSet(pr.enabled);
  const [weekend, setWeekend] = useStateSet(new Set(pr.weekendDays));
  const toggleDay = (d) => setWeekend((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  return (
    <div className="entrance">
      <SubHead back={back} title="Pricing rules" sub="Advisory only — these suggest a nightly rate and pre-fill new bookings, clamped to each room type's floor/ceiling. Never pushed to OTAs." />

      <div className="card card--pad">
        <div className="spread" style={{ paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
          <div><div className="h3" style={{ fontSize: "var(--fs-body)" }}>Pricing engine</div><div className="field-hint" style={{ marginTop: 2 }}>{on ? "On — suggestions active" : "Off"}</div></div>
          <button className={"switch" + (on ? " on" : "")} onClick={() => setOn(!on)} aria-label="Toggle pricing"><span /></button>
        </div>

        <div className="eyebrow eyebrow--accent" style={{ margin: "16px 0 9px" }}>Weekend</div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {DAY_LABELS.map((lbl, i) => (
            <button key={i} className={"chip" + (weekend.has(i) ? " on" : "")} style={{ minWidth: 42, justifyContent: "center", padding: "8px 0" }} onClick={() => toggleDay(i)}>{lbl}</button>
          ))}
        </div>
        <div className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
          <label className="field-label">Weekend adjustment</label>
          <div style={{ position: "relative" }}><input className="input num" defaultValue="20" style={{ paddingRight: 30 }} /><span style={{ position: "absolute", right: 12, top: 9, color: "var(--text-faint)" }}>%</span></div>
        </div>
      </div>

      <div className="card card--pad" style={{ marginTop: 12 }}>
        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 9 }}>Lead time</div>
        <div className="form-grid">
          <div className="field"><label className="field-label">Early-bird if ≥ days</label><input className="input num" defaultValue="30" /></div>
          <div className="field"><label className="field-label">Early-bird %</label><input className="input num" defaultValue="-10" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Last-minute if ≤ days</label><input className="input num" defaultValue="3" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Last-minute %</label><input className="input num" defaultValue="15" /></div>
        </div>
      </div>

      <div className="card card--pad" style={{ marginTop: 12 }}>
        <div className="eyebrow eyebrow--accent" style={{ marginBottom: 9 }}>Occupancy — high demand</div>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">When occupancy ≥</label><input className="input num" defaultValue="80" /></div>
          <div className="field" style={{ marginBottom: 0 }}><label className="field-label">Adjustment %</label><input className="input num" defaultValue="15" /></div>
        </div>
      </div>

      <button className="btn btn--primary btn--block" style={{ margin: "14px 0 8px" }}>Save pricing rules</button>

      <div className="section-label">
        <div className="section-label__l"><span className="section-label__t">Seasons &amp; holidays</span><span className="section-label__c">{DATA.seasons.length}</span></div>
        <button className="section-label__a"><RDIcon name="plus" size={13} /> Add season</button>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {DATA.seasons.map((s) => (
          <div key={s.name} className="rowcard" style={{ marginTop: 0 }}>
            <div className="rowcard__main">
              <div className="rowcard__name" style={{ fontSize: "var(--fs-small)" }}>{s.name}</div>
              <div className="rowcard__meta">{s.from} → {s.to}</div>
            </div>
            <div className="row" style={{ gap: 8, flex: "none" }}>
              <StatusBadge kind={s.pct >= 0 ? "warn" : "paid"}>{(s.pct > 0 ? "+" : "") + s.pct + "%"}</StatusBadge>
              <RowActions />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Blocked dates ---------- */
function Blocks({ back }) {
  return (
    <div className="entrance">
      <SubHead back={back} title="Blocked dates" sub="Hold a room out of service (repairs, deep clean, owner use). Blocked dates can't be booked and show on the calendar." action={<AddBtn>Block</AddBtn>} />
      {DATA.blocks.length === 0 ? <div className="empty">No maintenance blocks.</div> : (
        <div className="col" style={{ gap: 8 }}>
          {DATA.blocks.map((b, i) => (
            <div key={i} className="rowcard" style={{ marginTop: 0 }}>
              <span className="rowcard__lead" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}><RDIcon name="ban" size={16} /></span>
              <div className="rowcard__main">
                <div className="rowcard__name">Room {b.room}</div>
                <div className="rowcard__meta">{b.from} → {b.to} · {b.reason}</div>
              </div>
              <button className="btn btn--danger btn--sm" style={{ flex: "none" }}><RDIcon name="x" size={14} /> Remove</button>
            </div>
          ))}
        </div>
      )}
      <div className="card card--pad" style={{ marginTop: 12, background: "var(--red-bg)", borderColor: "var(--red-border)" }}>
        <div className="row" style={{ gap: 10 }}>
          <RDIcon name="alert" size={17} style={{ color: "var(--red-text)", flex: "none" }} />
          <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>
            The Room 102 block overlaps Priya Nair's booking — see <b style={{ color: "var(--red-text)" }}>Conflicts</b>.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Scam / flagged numbers ---------- */
function FlaggedNumbers({ back }) {
  return (
    <div className="entrance">
      <SubHead back={back} title="Scam numbers" sub="Phones on this list trigger a warning when you start a booking — so a known bad actor can't slip through." action={<AddBtn>Add number</AddBtn>} />
      <div className="col" style={{ gap: 8 }}>
        {DATA.flaggedNumbers.map((f, i) => (
          <div key={i} className="rowcard" style={{ marginTop: 0 }}>
            <span className="rowcard__lead" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}><RDIcon name="ban" size={16} /></span>
            <div className="rowcard__main">
              <div className="rowcard__name num">{f.phone}</div>
              <div className="rowcard__meta">{f.reason} · added {f.added}</div>
            </div>
            <RowActions showEdit={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

const SUB_PAGES = {
  property: PropertyDetails, roomtypes: RoomTypes,
  rooms: Rooms, channels: ChannelsSubpage, pricing: Pricing, blocks: Blocks, flagged: FlaggedNumbers,
};

function Settings({ desktop }) {
  const [sub, setSub] = useStateSet(desktop ? "property" : null);
  const back = () => setSub(null);

  if (desktop) {
    const cur = sub || "property";
    const Page = SUB_PAGES[cur];
    return (
      <div className="entrance set-md">
        <div className="set-md__list">
          <div className="display" style={{ fontSize: 22, marginBottom: 12 }}>Settings</div>
          {SET_GROUPS.map((g) => (
            <div key={g.label} className="setgroup">
              <div className="setgroup__label">{g.label}</div>
              <div className="setlist">
                {g.items.map((it) => (
                  <a key={it.id} className={"setrow" + (cur === it.id ? " setrow--on" : "")} onClick={() => setSub(it.id)}>
                    <span className="setrow__ic"><RDIcon name={it.icon} size={17} /></span>
                    <span className="setrow__main"><span className="setrow__t">{it.t}</span></span>
                    <RDIcon name="chevronR" size={16} className="setrow__chev" style={{ color: "var(--text-faint)" }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="set-md__detail"><Page back={back} /></div>
      </div>
    );
  }

  const Page = sub ? SUB_PAGES[sub] : null;
  if (Page) return <Page back={back} />;
  return <SettingsHub openSub={setSub} />;
}
window.Settings = Settings;
