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
const DESKTOP_TABS = [...PRIMARY, ...MORE];

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
      {/* mobile top brand bar */}
      <header className="appbar only-mobile">
        <Link href="/" className="brand">
          <span className="brand__mark"><Icon name="door" size={18} /></span>
          Ops Hub
        </Link>
      </header>

      {/* desktop top nav */}
      <nav className="topnav only-desktop">
        <Link href="/" className="brand">
          <span className="brand__mark"><Icon name="door" size={18} /></span>
          Ops Hub
        </Link>
        <div className="topnav__tabs">
          {DESKTOP_TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`topnav__tab${isActive(pathname, t.href) ? " on" : ""}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <Link href="/reservations/new" className="btn btn--primary btn--sm" style={{ marginLeft: 8 }}>
          <Icon name="plus" size={16} /> New
        </Link>
        <button onClick={logout} className="btn btn--ghost btn--sm" title="Log out">
          <Icon name="logout" size={16} />
        </button>
      </nav>

      {/* mobile FAB */}
      <Link href="/reservations/new" className="fab only-mobile" aria-label="New reservation">
        <Icon name="plus" size={24} />
      </Link>

      {/* mobile bottom tab bar */}
      <nav className="tabbar only-mobile">
        {PRIMARY.map((t) => (
          <Link key={t.href} href={t.href} className={`tab${isActive(pathname, t.href) ? " tab--on" : ""}`}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </Link>
        ))}
        <button className={`tab${moreActive || sheet ? " tab--on" : ""}`} onClick={() => setSheet(true)}>
          <Icon name="more" size={22} />
          More
        </button>
      </nav>

      {/* More sheet */}
      {sheet && (
        <div className="sheet-backdrop only-mobile" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grab" />
            {MORE.map((m) => (
              <Link key={m.href} href={m.href} className="sheet__row" onClick={() => setSheet(false)}>
                <span className="sheet__ic"><Icon name={m.icon} size={19} /></span>
                {m.label}
              </Link>
            ))}
            <div className="hairline" style={{ margin: "6px 0" }} />
            <button className="sheet__row" onClick={logout}>
              <span className="sheet__ic"><Icon name="logout" size={19} /></span>
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
