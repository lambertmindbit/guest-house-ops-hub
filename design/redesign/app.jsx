/* redesign/app.jsx — prototype shell: phone + desktop frames, consolidated IA.
   Phone bar: Today · Calendar · ＋New · Bookings · More(hub screen).
   "Needs you" merges conflicts+escalations. Setup is one door. */
var { useState, useEffect } = React;

const TITLES = {
  today: "Today", calendar: "Calendar", bookings: "Bookings", guests: "Guests", housekeeping: "Cleaning",
  pricing: "Pricing", finance: "Finance", analytics: "Analytics", needsyou: "Needs you",
  inbox: "Inbox", messages: "Messages", settings: "Settings", more: "More",
  reservation: "Reservation", new: "New booking",
};

// Phone bottom bar (FAB + More handled separately)
const PRIMARY = [
  { id: "today", label: "Today", icon: "today" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "bookings", label: "Bookings", icon: "bed" },
];

// Desktop sidebar — grouped; Setup collapses to one entry.
const SIDEBAR_GROUPS = [
  { label: "Operate", items: ["today", "calendar", "bookings", "guests", "housekeeping", "needsyou"] },
  { label: "Business", items: ["finance", "pricing", "analytics"] },
  { label: "Review", items: ["inbox", "messages"] },
  { label: "Setup", items: ["settings"] },
];

const META = {
  today: { label: "Today", icon: "today" }, calendar: { label: "Calendar", icon: "calendar" },
  bookings: { label: "Bookings", icon: "bed" }, guests: { label: "Guests", icon: "guests" },
  housekeeping: { label: "Cleaning", icon: "clean" }, needsyou: { label: "Needs you", icon: "alert" },
  pricing: { label: "Pricing", icon: "tag" }, finance: { label: "Finance", icon: "wallet" },
  analytics: { label: "Analytics", icon: "chart" }, inbox: { label: "Inbox", icon: "inbox" },
  messages: { label: "Messages", icon: "inbox" }, settings: { label: "Property setup", icon: "settings" },
};

let go = () => {}; // bound inside App

function renderScreen(screen, nav, desktop) {
  switch (screen) {
    case "today": return <Today go={nav} />;
    case "calendar": return <Calendar go={nav} defaultView="day" />;
    case "calendar-grid": return <Calendar go={nav} defaultView="grid" />;
    case "bookings": return <Bookings go={nav} />;
    case "more": return <MoreHub go={nav} />;
    case "guests": return <Guests go={nav} />;
    case "housekeeping": return <Housekeeping go={nav} />;
    case "needsyou": return <NeedsYou go={nav} />;
    case "messages": return <Messages go={nav} />;
    case "inbox": return <Inbox go={nav} />;
    case "finance": return <Finance go={nav} />;
    case "settings": return <Settings go={nav} desktop={desktop} />;
    case "new": return <NewReservation go={nav} />;
    case "reservation": return <ReservationDetail go={nav} />;
    case "pricing": return <Pricing go={nav} />;
    case "analytics": return <Analytics go={nav} />;
    default: return <Today go={nav} />;
  }
}

const PRIMARY_IDS = ["today", "calendar", "bookings"];
function activeTab(screen) {
  if (PRIMARY_IDS.includes(screen)) return screen;
  if (screen === "new" || screen === "reservation") return "bookings";
  return "more";
}

function PhoneFrame({ screen, nav, prefs, setPref }) {
  const dark = prefs.appearance === "dark";
  const active = activeTab(screen);
  return (
    <div className="phone">
      <div className="phone__notch" />
      <div className="appbar">
        <div className="appbar__status">
          <span className="appbar__time">9:41</span>
          <span style={{ display: "flex", gap: 5, opacity: 0.85 }}>
            <RDIcon name="bolt" size={13} /><span style={{ fontSize: 11, fontWeight: 700 }}>5G</span>
          </span>
        </div>
        <div className="appbar__nav">
          <a className="appbar__brand" onClick={() => nav("today")} style={{ cursor: "pointer" }}>
            <span className="brandmark"><RDIcon name="door" size={17} /></span>
            <span className="appbar__name"><b>Ops Hub</b><span>Hillview Guest House</span></span>
          </a>
          <div className="appbar__actions">
            <button className="iconbtn" onClick={() => setPref("appearance", dark ? "light" : "dark")} aria-label="Toggle dark"><RDIcon name={dark ? "sun" : "moon"} size={18} /></button>
          </div>
        </div>
      </div>

      <div className="screen" key={screen}>{renderScreen(screen, nav)}</div>

      <nav className="tabbar">
        {PRIMARY.map((t) => (
          <a key={t.id} className={"tab" + (active === t.id ? " on" : "")} onClick={() => nav(t.id)}>
            <RDIcon name={t.icon} size={22} /> {t.label}
          </a>
        ))}
        <div className="tab__slot"><button className="fab" onClick={() => nav("new")} aria-label="New booking"><RDIcon name="plus" size={24} /></button></div>
        <a className={"tab" + (active === "more" ? " on" : "")} onClick={() => nav("more")}>
          <RDIcon name="more" size={22} /> More
        </a>
      </nav>
    </div>
  );
}

function DesktopFrame({ screen, nav, prefs, setPref, openPrefs }) {
  const dark = prefs.appearance === "dark";
  const active = activeTab(screen);
  return (
    <div className="desktop">
      <div className="dtopbar">
        <span className="dot" style={{ background: "#ff5f57" }} /><span className="dot" style={{ background: "#febc2e" }} /><span className="dot" style={{ background: "#28c840" }} />
        <span className="muted" style={{ marginLeft: 10, fontSize: "var(--fs-meta)" }}>Ops Hub — Hillview Guest House</span>
      </div>
      <div className="dbody">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <span className="brandmark"><RDIcon name="door" size={17} /></span>
            <span className="appbar__name"><b style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)" }}>Ops Hub</b><span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Hillview</span></span>
          </div>
          {SIDEBAR_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="sidebar__group">{g.label}</div>
              {g.items.map((id) => (
                <a key={id} className={"navitem" + (screen === id || active === id ? " on" : "")} onClick={() => nav(id)}>
                  <span className="navitem__ic"><RDIcon name={META[id].icon} size={17} /></span>{META[id].label}
                  {id === "needsyou" && <span className="navitem__badge">2</span>}
                </a>
              ))}
            </div>
          ))}
          <div className="sidebar__spacer" />
          <a className="navitem" onClick={openPrefs}><span className="navitem__ic"><RDIcon name="settings" size={17} /></span>Preferences</a>
        </aside>
        <div className="dmain">
          <div className="dtoolbar">
            <span className="display" style={{ fontSize: 17 }}>{TITLES[screen] || "Today"}</span>
            <div style={{ flex: 1 }} />
            <div className="dsearch"><RDIcon name="search" size={15} /><input placeholder="Search guests & bookings…" /></div>
            <button className="iconbtn" onClick={() => setPref("appearance", dark ? "light" : "dark")}><RDIcon name={dark ? "sun" : "moon"} size={17} /></button>
            <button className="btn btn--primary btn--sm" onClick={() => nav("new")}><RDIcon name="plus" size={15} /> New booking</button>
          </div>
          <div className="dcontent" key={screen}>{renderScreen(screen === "calendar" ? "calendar-grid" : screen, nav, true)}</div>
        </div>
      </div>
    </div>
  );
}

function Prefs({ prefs, setPref, close }) {
  const tints = [{ k: "teal", c: "#006b5f" }, { k: "navy", c: "#1e40af" }, { k: "blue", c: "#2563eb" }, { k: "violet", c: "#6d28d9" }];
  return (
    <div className="prefs-backdrop" onClick={close}>
      <div className="prefs" onClick={(e) => e.stopPropagation()}>
        <div className="prefs__hd"><b>Preferences</b><button className="stage-iconbtn" onClick={close}><RDIcon name="x" size={16} /></button></div>
        <div className="prefs__body">
          <div className="prefs__group">Appearance</div>
          <div className="seg" style={{ width: "100%" }}>
            {["light", "dark", "system"].map((a) => (
              <button key={a} style={{ flex: 1, textTransform: "capitalize" }} className={prefs.appearance === a ? "on" : ""} onClick={() => setPref("appearance", a)}>{a}</button>
            ))}
          </div>
          <div className="prefs__group">Accent</div>
          <div className="swatches">
            {tints.map((t) => (
              <button key={t.k} className={"swatch" + (prefs.tint === t.k ? " on" : "")} style={{ background: t.c }} onClick={() => setPref("tint", t.k)}>
                {prefs.tint === t.k && <RDIcon name="check" size={16} />}
              </button>
            ))}
          </div>
          <div className="prefs__group">Density</div>
          <div className="seg" style={{ width: "100%" }}>
            {["comfortable", "compact"].map((d) => (
              <button key={d} style={{ flex: 1, textTransform: "capitalize" }} className={prefs.density === d ? "on" : ""} onClick={() => setPref("density", d)}>{d}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [platform, setPlatform] = useState("phone");
  const [screen, setScreen] = useState("today");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState({ appearance: "light", tint: "teal", density: "comfortable" });

  const nav = (s) => { setScreen(s); };
  go = nav;

  function setPref(key, value) {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      const d = document.documentElement;
      const eff = key === "appearance" ? (value === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value) : next.appearance === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next.appearance;
      d.setAttribute("data-appearance", eff);
      d.setAttribute("data-tint", next.tint);
      d.setAttribute("data-density", next.density);
      return next;
    });
  }
  useEffect(() => {
    const d = document.documentElement;
    d.setAttribute("data-appearance", prefs.appearance);
    d.setAttribute("data-tint", prefs.tint);
    d.setAttribute("data-density", prefs.density);
  }, []);

  return (
    <div className="stage">
      <div className="stage-bar">
        <span className="stage-title">Ops Hub · Redesign</span>
        <div className="seg">
          <button className={platform === "phone" ? "on" : ""} onClick={() => setPlatform("phone")}>iPhone</button>
          <button className={platform === "desktop" ? "on" : ""} onClick={() => setPlatform("desktop")}>Desktop</button>
        </div>
        <button className="stage-iconbtn" onClick={() => setPrefsOpen(true)} aria-label="Preferences"><RDIcon name="settings" size={17} /></button>
      </div>

      {platform === "phone"
        ? <PhoneFrame screen={screen} nav={nav} prefs={prefs} setPref={setPref} />
        : <DesktopFrame screen={screen} nav={nav} prefs={prefs} setPref={setPref} openPrefs={() => setPrefsOpen(true)} />}

      {prefsOpen && <Prefs prefs={prefs} setPref={setPref} close={() => setPrefsOpen(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
