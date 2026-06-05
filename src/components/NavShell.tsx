"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

// One config drives BOTH the phone tabs/sheet and the desktop sidebar.
type NavId =
  | "today" | "calendar" | "guests" | "housekeeping" | "pricing"
  | "finance" | "analytics" | "conflicts" | "inbox" | "feeds" | "settings" | "help"
  | "set-property" | "set-room-types" | "set-rooms" | "set-channels" | "set-pricing" | "set-blocks";

const META: Record<NavId, { label: string; icon: string; href: string }> = {
  today: { label: "Today", icon: "today", href: "/" },
  calendar: { label: "Calendar", icon: "calendar", href: "/calendar" },
  guests: { label: "Guests", icon: "guests", href: "/guests" },
  // Kept the owner's earlier "Housekeeping" rename (the redesign guide says "Cleaning").
  housekeeping: { label: "Housekeeping", icon: "clean", href: "/housekeeping" },
  pricing: { label: "Pricing", icon: "tag", href: "/pricing" },
  finance: { label: "Finance", icon: "wallet", href: "/finance" },
  analytics: { label: "Analytics", icon: "chart", href: "/analytics" },
  conflicts: { label: "Conflicts", icon: "alert", href: "/conflicts" },
  inbox: { label: "Inbox", icon: "inbox", href: "/inbox" },
  feeds: { label: "Feeds", icon: "link", href: "/feeds" },
  settings: { label: "Settings", icon: "settings", href: "/settings" },
  help: { label: "Help", icon: "help", href: "/help" },
  // Settings sub-modules — surfaced directly in the desktop sidebar.
  "set-property": { label: "Property", icon: "settings", href: "/settings/property" },
  "set-room-types": { label: "Room types", icon: "bed", href: "/settings/room-types" },
  "set-rooms": { label: "Rooms", icon: "door", href: "/settings/rooms" },
  "set-channels": { label: "Channels", icon: "link", href: "/settings/channels" },
  "set-pricing": { label: "Pricing rules", icon: "tag", href: "/settings/pricing" },
  "set-blocks": { label: "Blocked dates", icon: "alert", href: "/settings/blocks" },
};

const PRIMARY: NavId[] = ["today", "calendar", "guests"];

// Desktop sidebar: Settings' modules are listed directly under "Setup".
const SIDEBAR_GROUPS: { label: string; items: NavId[] }[] = [
  { label: "Operate", items: ["today", "calendar", "guests", "housekeeping"] },
  { label: "Money", items: ["pricing", "finance"] },
  { label: "Insights", items: ["analytics", "conflicts"] },
  { label: "Data", items: ["inbox", "feeds"] },
  { label: "Setup", items: ["set-property", "set-room-types", "set-rooms", "set-channels", "set-pricing", "set-blocks"] },
  { label: "Help", items: ["help"] },
];

// Phone "More" sheet: keep one Settings entry → the hub (don't bloat the sheet).
const SHEET_GROUPS: { label: string; items: NavId[] }[] = [
  { label: "Operations", items: ["housekeeping", "conflicts"] },
  { label: "Money", items: ["pricing", "finance"] },
  { label: "Insights", items: ["analytics"] },
  { label: "Data & channels", items: ["inbox", "feeds"] },
  { label: "System", items: ["settings", "help"] },
];

const TINTS = [
  { key: "teal", color: "#006b5f" },
  { key: "navy", color: "#1e40af" },
  { key: "blue", color: "#2563eb" },
  { key: "violet", color: "#6d28d9" },
];

type Prefs = { appearance: string; tint: string; density: string };
const STORE: Record<keyof Prefs, string> = {
  appearance: "ops-appearance",
  tint: "ops-tint",
  density: "ops-density",
};

// Which nav id "owns" the current route. Reservation routes map to Calendar.
// Longest matching href wins so /settings/rooms picks "set-rooms", not "settings".
function activeId(pathname: string): NavId {
  if (pathname === "/") return "today";
  if (pathname.startsWith("/reservations")) return "calendar";
  let best: NavId = "today";
  let bestLen = -1;
  for (const id of Object.keys(META) as NavId[]) {
    const href = META[id].href;
    if (href === "/") continue;
    if ((pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(href)) && href.length > bestLen) {
      best = id;
      bestLen = href.length;
    }
  }
  return best;
}

function toolbarTitle(pathname: string): string {
  if (pathname === "/reservations/new") return "New booking";
  if (pathname.startsWith("/reservations")) return "Reservation";
  return META[activeId(pathname)].label;
}

export function NavShell({ conflictCount = 0 }: { conflictCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ appearance: "system", tint: "teal", density: "comfortable" });
  const [effDark, setEffDark] = useState(false);

  useEffect(() => {
    const ls = localStorage;
    setPrefs({
      appearance: ls.getItem(STORE.appearance) ?? "system",
      tint: ls.getItem(STORE.tint) ?? "teal",
      density: ls.getItem(STORE.density) ?? "comfortable",
    });
    setEffDark(document.documentElement.getAttribute("data-appearance") === "dark");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORE.appearance) ?? "system") === "system") {
        document.documentElement.setAttribute("data-appearance", mq.matches ? "dark" : "light");
        setEffDark(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function setPref(key: keyof Prefs, value: string) {
    localStorage.setItem(STORE[key], value);
    setPrefs((p) => ({ ...p, [key]: value }));
    const d = document.documentElement;
    if (key === "appearance") {
      const eff = value === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
      d.setAttribute("data-appearance", eff);
      setEffDark(eff === "dark");
    } else {
      d.setAttribute(`data-${key}`, value);
    }
  }

  if (pathname === "/login") return null;

  const active = activeId(pathname);
  const moreActive = !PRIMARY.includes(active);
  const toggleAppearance = () => setPref("appearance", effDark ? "light" : "dark");

  async function logout() {
    setSheet(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* ---------- mobile: top app bar ---------- */}
      <header className="rd-appbar rd-m">
        <div className="rd-appbar__nav">
          <Link href="/" className="rd-appbar__brand">
            <span className="brandmark"><Icon name="door" size={17} /></span>
            <span className="rd-appbar__name"><b>Ops Hub</b><span>Guest House</span></span>
          </Link>
          <button className="iconbtn" onClick={toggleAppearance} aria-label="Toggle dark mode">
            <Icon name={effDark ? "sun" : "moon"} size={18} />
          </button>
        </div>
      </header>

      {/* ---------- mobile: bottom tab bar ---------- */}
      <nav className="tabbar rd-m">
        {PRIMARY.map((id) => (
          <Link key={id} href={META[id].href} className={`tab${active === id ? " on" : ""}`}>
            <Icon name={META[id].icon} size={22} />
            {META[id].label}
          </Link>
        ))}
        <div className="tab__slot">
          <Link href="/reservations/new" className="fab" aria-label="New booking">
            <Icon name="plus" size={24} />
          </Link>
        </div>
        <button className={`tab${moreActive || sheet ? " on" : ""}`} onClick={() => setSheet(true)}>
          <Icon name="more" size={22} />
          More
        </button>
      </nav>

      {/* ---------- mobile: More sheet ---------- */}
      {sheet && (
        <div className="sheet-backdrop rd-m" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__handle" />
            {SHEET_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="sheet__group">{g.label}</div>
                {g.items.map((id) => (
                  <Link key={id} href={META[id].href} className="sheet__row" onClick={() => setSheet(false)}>
                    <span className="sheet__ic"><Icon name={META[id].icon} size={17} /></span>
                    {META[id].label}
                    {id === "conflicts" && conflictCount > 0 && (
                      <span className="navitem__badge" style={{ marginLeft: "auto" }}>{conflictCount}</span>
                    )}
                    <Icon name="chevronR" size={16} className="sheet__chev" />
                  </Link>
                ))}
              </div>
            ))}
            <div className="sheet__group">Account</div>
            <button className="sheet__row" onClick={() => { setSheet(false); setPanel(true); }}>
              <span className="sheet__ic"><Icon name="settings" size={17} /></span>
              Preferences
            </button>
            <button className="sheet__row" onClick={logout}>
              <span className="sheet__ic"><Icon name="logout" size={17} /></span>
              Log out
            </button>
          </div>
          <button className="sheet__cancel" onClick={() => setSheet(false)}>Close</button>
        </div>
      )}

      {/* ---------- desktop: sidebar ---------- */}
      <aside className="sidebar rd-d">
        <Link href="/" className="sidebar__brand">
          <span className="brandmark"><Icon name="door" size={17} /></span>
          <span><b>Ops Hub</b><span>Guest House</span></span>
        </Link>
        {SIDEBAR_GROUPS.map((g) => (
          <div key={g.label}>
            <div className="sidebar__group">{g.label}</div>
            {g.items.map((id) => (
              <Link key={id} href={META[id].href} className={`navitem${active === id ? " on" : ""}`}>
                <span className="navitem__ic"><Icon name={META[id].icon} size={17} /></span>
                {META[id].label}
                {id === "conflicts" && conflictCount > 0 && <span className="navitem__badge">{conflictCount}</span>}
              </Link>
            ))}
          </div>
        ))}
        <div className="sidebar__spacer" />
        <button className="navitem" onClick={() => setPanel(true)}>
          <span className="navitem__ic"><Icon name="settings" size={17} /></span>
          Preferences
        </button>
        <button className="navitem" onClick={logout}>
          <span className="navitem__ic"><Icon name="logout" size={17} /></span>
          Log out
        </button>
      </aside>

      {/* ---------- desktop: top toolbar ---------- */}
      <div className="dtoolbar rd-d">
        <span className="dtoolbar__title">{toolbarTitle(pathname)}</span>
        <div className="dtoolbar__spacer" />
        <form action="/guests" className="dsearch">
          <Icon name="search" size={15} />
          <input name="q" placeholder="Search guests…" aria-label="Search guests" />
        </form>
        <button className="iconbtn" onClick={toggleAppearance} aria-label="Toggle dark mode">
          <Icon name={effDark ? "sun" : "moon"} size={17} />
        </button>
        <Link href="/reservations/new" className="btn btn--primary btn--sm">
          <Icon name="plus" size={15} /> New booking
        </Link>
      </div>

      {/* ---------- Preferences popover ---------- */}
      {panel && (
        <div className="prefs-backdrop" onClick={() => setPanel(false)}>
          <div className="prefs" onClick={(e) => e.stopPropagation()}>
            <div className="prefs__hd">
              <b>Preferences</b>
              <button className="iconbtn" onClick={() => setPanel(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            </div>
            <div className="prefs__body">
              <div className="prefs__group">Appearance</div>
              <div className="seg" style={{ width: "100%" }}>
                {["light", "dark", "system"].map((a) => (
                  <button key={a} style={{ flex: 1, textTransform: "capitalize" }} className={prefs.appearance === a ? "on" : ""} onClick={() => setPref("appearance", a)}>{a}</button>
                ))}
              </div>

              <div className="prefs__group">Accent</div>
              <div className="swatches">
                {TINTS.map((t) => (
                  <button key={t.key} className={`swatch${prefs.tint === t.key ? " on" : ""}`} style={{ background: t.color }} onClick={() => setPref("tint", t.key)} aria-label={`${t.key} accent`}>
                    {prefs.tint === t.key && <Icon name="check" size={16} />}
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
      )}
    </>
  );
}
