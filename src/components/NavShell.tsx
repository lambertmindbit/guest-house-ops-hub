"use client";

import { useState } from "react";
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

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavShell() {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);

  if (pathname === "/login") return null;

  const moreActive = MORE.some((m) => isActive(pathname, m.href));

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
            <span className="ios-nav__name">
              <b>Ops Hub</b>
              <span>Guest House</span>
            </span>
          </Link>
          <Link href="/reservations/new" className="ios-navbtn" aria-label="New reservation">
            <Icon name="plus" size={20} />
          </Link>
        </div>
      </header>

      {/* ---------- macOS toolbar (desktop) ---------- */}
      <div className="mac-toolbar only-desktop">
        <span className="brand__mark"><Icon name="door" size={18} /></span>
        <div className="mac-toolbar__title">
          Ops Hub
          <small>Guest House</small>
        </div>
        <div className="mac-toolbar__spacer" />
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
            <button className="ios-sheet__row" onClick={logout}>
              <span className="ios-sheet__ic"><Icon name="logout" size={18} /></span>
              Log out
            </button>
          </div>
          <button className="ios-sheet__cancel" onClick={() => setSheet(false)}>Cancel</button>
        </div>
      )}
    </>
  );
}
