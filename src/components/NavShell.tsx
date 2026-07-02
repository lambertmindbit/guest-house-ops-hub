"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { canSeeNav, type Role } from "@/lib/authz";

// One config drives BOTH the phone tabs and the desktop sidebar.
// Round-2 IA consolidation: ~24 destinations → a small primary set + shallow
// grouped secondary areas. Conflicts+Escalations merge into "Needs you"; the
// 8 setup modules collapse behind one "Property setup" door (the /settings hub);
// "More" is a real /more hub screen on phone (no bottom sheet).
type NavId =
  | "today" | "calendar" | "bookings" | "guests" | "housekeeping" | "complaints" | "staff" | "needsyou"
  | "maintenance" | "inventory" | "vendors" | "transport"
  | "finance" | "pricing" | "analytics" | "inbox" | "messages" | "escalations" | "settings" | "help";

const META: Record<NavId, { label: string; icon: string; href: string }> = {
  today: { label: "Today", icon: "today", href: "/" },
  calendar: { label: "Calendar", icon: "calendar", href: "/calendar" },
  bookings: { label: "Bookings", icon: "bed", href: "/reservations" },
  guests: { label: "Guests", icon: "guests", href: "/guests" },
  // Owner previously kept "Housekeeping" over the guide's "Cleaning" — preserved.
  housekeeping: { label: "Housekeeping", icon: "clean", href: "/housekeeping" },
  complaints: { label: "Complaints", icon: "alertCircle", href: "/complaints" },
  staff: { label: "Staff", icon: "guests", href: "/staff" },
  maintenance: { label: "Maintenance", icon: "wrench", href: "/maintenance" },
  inventory: { label: "Inventory", icon: "box", href: "/inventory" },
  vendors: { label: "Vendors", icon: "receipt", href: "/vendors" },
  transport: { label: "Transport", icon: "truck", href: "/transport" },
  needsyou: { label: "Needs you", icon: "alert", href: "/needs-you" },
  finance: { label: "Finance", icon: "wallet", href: "/finance" },
  pricing: { label: "Pricing", icon: "tag", href: "/pricing" },
  analytics: { label: "Analytics", icon: "chart", href: "/analytics" },
  inbox: { label: "Inbox", icon: "inbox", href: "/inbox" },
  messages: { label: "Messages", icon: "inbox", href: "/messages" },
  escalations: { label: "Escalations", icon: "alert", href: "/escalations" },
  settings: { label: "Property setup", icon: "settings", href: "/settings" },
  help: { label: "Help", icon: "help", href: "/help" },
};

const PRIMARY: NavId[] = ["today", "calendar", "bookings"];

// Desktop sidebar — grouped; Setup is one entry (the /settings hub owns the rest).
const SIDEBAR_GROUPS: { label: string; items: NavId[] }[] = [
  { label: "Operate", items: ["today", "calendar", "bookings", "guests", "housekeeping", "complaints", "staff", "needsyou"] },
  { label: "Facilities", items: ["maintenance", "inventory", "vendors", "transport"] },
  { label: "Business", items: ["finance", "pricing", "analytics"] },
  { label: "Review", items: ["inbox", "messages", "escalations"] },
  { label: "Setup", items: ["settings"] },
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

// Which nav id "owns" the current route. Deep-link routes that no longer have a
// standing nav entry fold onto their consolidated owner:
//   /reservations*           → bookings
//   /needs-you /conflicts /escalations → needsyou
//   /settings* /feeds        → settings (the "Property setup" door)
function activeId(pathname: string): NavId {
  if (pathname === "/") return "today";
  if (pathname.startsWith("/reservations")) return "bookings";
  if (pathname.startsWith("/needs-you") || pathname.startsWith("/conflicts")) return "needsyou";
  if (pathname.startsWith("/settings") || pathname.startsWith("/feeds")) return "settings";
  let best: NavId = "today";
  let bestLen = -1;
  for (const id of Object.keys(META) as NavId[]) {
    const href = META[id].href;
    if (href === "/") continue;
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > bestLen) {
      best = id;
      bestLen = href.length;
    }
  }
  return best;
}

function toolbarTitle(pathname: string): string {
  if (pathname === "/reservations/new") return "New booking";
  if (pathname.startsWith("/reservations/")) return "Reservation";
  if (pathname.startsWith("/more")) return "More";
  return META[activeId(pathname)].label;
}

export function NavShell({ conflictCount = 0, escalationCount = 0, role = "owner" }: { conflictCount?: number; escalationCount?: number; role?: Role }) {
  const pathname = usePathname();
  const router = useRouter();
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
  const onMore = pathname.startsWith("/more");
  const moreActive = onMore || !PRIMARY.includes(active);
  const needsYouCount = conflictCount + escalationCount;
  const toggleAppearance = () => setPref("appearance", effDark ? "light" : "dark");

  async function logout() {
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
          <div className="row" style={{ gap: 2 }}>
            <button className="iconbtn" onClick={() => setPanel(true)} aria-label="Preferences">
              <Icon name="settings" size={18} />
            </button>
            <button className="iconbtn" onClick={toggleAppearance} aria-label="Toggle dark mode">
              <Icon name={effDark ? "sun" : "moon"} size={18} />
            </button>
          </div>
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
        <Link href="/more" className={`tab${moreActive ? " on" : ""}`}>
          <Icon name="more" size={22} />
          More
        </Link>
      </nav>

      {/* ---------- desktop: sidebar ---------- */}
      <aside className="sidebar rd-d">
        <Link href="/" className="sidebar__brand">
          <span className="brandmark"><Icon name="door" size={17} /></span>
          <span><b>Ops Hub</b><span>Guest House</span></span>
        </Link>
        {SIDEBAR_GROUPS.map((g) => ({ ...g, items: g.items.filter((id) => canSeeNav(role, id)) }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
          <div key={g.label}>
            <div className="sidebar__group">{g.label}</div>
            {g.items.map((id) => (
              <Link key={id} href={META[id].href} className={`navitem${active === id ? " on" : ""}`}>
                <span className="navitem__ic"><Icon name={META[id].icon} size={17} /></span>
                {META[id].label}
                {id === "needsyou" && needsYouCount > 0 && <span className="navitem__badge">{needsYouCount}</span>}
                {id === "escalations" && escalationCount > 0 && <span className="navitem__badge">{escalationCount}</span>}
              </Link>
            ))}
          </div>
        ))}
        <div className="sidebar__spacer" />
        <Link href="/help" className={`navitem${active === "help" ? " on" : ""}`}>
          <span className="navitem__ic"><Icon name="help" size={17} /></span>
          Help
        </Link>
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
