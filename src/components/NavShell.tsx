"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui";

const PRIMARY = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/guests", label: "Guests", icon: "guests" },
  { href: "/housekeeping", label: "Cleaning", icon: "clean" },
];
const MORE = [
  { href: "/finance", label: "Finance", icon: "wallet" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/conflicts", label: "Conflicts", icon: "alert" },
  { href: "/feeds", label: "Feeds", icon: "link" },
];
const ALL = [...PRIMARY, ...MORE];

const TINTS = [
  { key: "green", color: "#34c759" },
  { key: "blue", color: "#007aff" },
  { key: "indigo", color: "#5856d6" },
  { key: "warm", color: "#0fa68e" },
];

type Prefs = { appearance: string; tint: string; material: string; btnshape: string };
const STORE: Record<keyof Prefs, string> = {
  appearance: "ops-appearance",
  tint: "ops-tint",
  material: "ops-material",
  btnshape: "ops-btnshape",
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavShell() {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ appearance: "system", tint: "warm", material: "rich", btnshape: "rounded" });
  const [effDark, setEffDark] = useState(false);

  useEffect(() => {
    const ls = localStorage;
    setPrefs({
      appearance: ls.getItem(STORE.appearance) ?? "system",
      tint: ls.getItem(STORE.tint) ?? "warm",
      material: ls.getItem(STORE.material) ?? "rich",
      btnshape: ls.getItem(STORE.btnshape) ?? "rounded",
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

  const moreActive = MORE.some((m) => isActive(pathname, m.href));
  const toggleAppearance = () => setPref("appearance", effDark ? "light" : "dark");

  async function logout() {
    setSheet(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* ---------- iOS header (mobile) ---------- */}
      <header className="ios-header only-mobile">
        <div className="ios-nav">
          <Link href="/" className="ios-nav__brand">
            <span className="brand__mark"><Icon name="door" size={18} /></span>
            <span className="ios-nav__name"><b>Ops Hub</b><span>Guest House</span></span>
          </Link>
          <div className="row" style={{ gap: 6 }}>
            <button className="ios-navbtn" onClick={toggleAppearance} aria-label="Toggle dark mode">
              <Icon name={effDark ? "sun" : "moon"} size={19} />
            </button>
            <Link href="/reservations/new" className="ios-navbtn" aria-label="New reservation">
              <Icon name="plus" size={20} />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- macOS toolbar (desktop) ---------- */}
      <div className="mac-toolbar only-desktop">
        <span className="brand__mark"><Icon name="door" size={18} /></span>
        <div className="mac-toolbar__title">Ops Hub<small>Guest House</small></div>
        <div className="mac-toolbar__spacer" />
        <button className="chrome-btn" onClick={toggleAppearance} aria-label="Toggle dark mode">
          <Icon name={effDark ? "sun" : "moon"} size={18} />
        </button>
        <button className="chrome-btn" onClick={() => setPanel(true)} aria-label="Preferences">
          <Icon name="settings" size={18} />
        </button>
        <Link href="/reservations/new" className="btn btn--primary btn--sm">
          <Icon name="plus" size={16} /> New
        </Link>
      </div>

      {/* ---------- macOS sidebar (desktop) ---------- */}
      <aside className="mac-sidebar only-desktop">
        <div className="mac-sidebar__grouplabel">Menu</div>
        {ALL.map((t) => (
          <Link key={t.href} href={t.href} className={`mac-navitem${isActive(pathname, t.href) ? " on" : ""}`}>
            <span className="mac-navitem__ic"><Icon name={t.icon} size={18} /></span>
            {t.label}
          </Link>
        ))}
        <div className="mac-sidebar__grouplabel">Account</div>
        <button className="mac-navitem" onClick={logout}>
          <span className="mac-navitem__ic"><Icon name="logout" size={18} /></span>
          Log out
        </button>
      </aside>

      {/* ---------- iOS tab bar (mobile) ---------- */}
      <nav className="ios-tabbar only-mobile">
        {PRIMARY.map((t) => (
          <Link key={t.href} href={t.href} className={`ios-tab${isActive(pathname, t.href) ? " on" : ""}`}>
            <Icon name={t.icon} size={23} />
            {t.label}
          </Link>
        ))}
        <button className={`ios-tab${moreActive || sheet ? " on" : ""}`} onClick={() => setSheet(true)}>
          <Icon name="more" size={23} />
          More
        </button>
      </nav>

      {/* ---------- iOS action sheet (More) ---------- */}
      {sheet && (
        <div className="ios-sheet-backdrop only-mobile" onClick={() => setSheet(false)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ios-sheet__hd">More</div>
            {MORE.map((m) => (
              <Link key={m.href} href={m.href} className="ios-sheet__row" onClick={() => setSheet(false)}>
                <span className="ios-sheet__ic"><Icon name={m.icon} size={18} /></span>
                {m.label}
              </Link>
            ))}
            <button className="ios-sheet__row" onClick={() => { setSheet(false); setPanel(true); }}>
              <span className="ios-sheet__ic"><Icon name="settings" size={18} /></span>
              Preferences
            </button>
            <button className="ios-sheet__row" onClick={logout}>
              <span className="ios-sheet__ic"><Icon name="logout" size={18} /></span>
              Log out
            </button>
          </div>
          <button className="ios-sheet__cancel" onClick={() => setSheet(false)}>Cancel</button>
        </div>
      )}

      {/* ---------- Preferences panel ---------- */}
      {panel && (
        <div className="tweaks-backdrop" onClick={() => setPanel(false)}>
          <div className="tweaks" onClick={(e) => e.stopPropagation()}>
            <div className="tweaks__hd">
              <b>Preferences</b>
              <button className="chrome-btn" onClick={() => setPanel(false)} aria-label="Close"><Icon name="x" size={17} /></button>
            </div>
            <div className="tweaks__body">
              <div className="tweaks__group">Appearance</div>
              <div className="tweaks__row">
                <label>Dark mode</label>
                <button className={`switch${effDark ? " on" : ""}`} onClick={toggleAppearance} aria-label="Dark mode"><span /></button>
              </div>

              <div className="tweaks__group">Accent tint</div>
              <div className="swatches">
                {TINTS.map((t) => (
                  <button key={t.key} className={`swatch-btn${prefs.tint === t.key ? " on" : ""}`} style={{ background: t.color }} onClick={() => setPref("tint", t.key)} aria-label={`${t.key} accent`}>
                    {prefs.tint === t.key && <Icon name="check" size={18} />}
                  </button>
                ))}
              </div>

              <div className="tweaks__group">Material</div>
              <div className="segmented">
                <button className={prefs.material === "rich" ? "on" : ""} onClick={() => setPref("material", "rich")}>Rich</button>
                <button className={prefs.material === "crisp" ? "on" : ""} onClick={() => setPref("material", "crisp")}>Crisp</button>
              </div>

              <div className="tweaks__group">Button shape</div>
              <div className="segmented">
                <button className={prefs.btnshape === "rounded" ? "on" : ""} onClick={() => setPref("btnshape", "rounded")}>Rounded</button>
                <button className={prefs.btnshape === "pill" ? "on" : ""} onClick={() => setPref("btnshape", "pill")}>Pill</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
