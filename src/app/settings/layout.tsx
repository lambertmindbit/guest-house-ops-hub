"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

// Settings master/detail: on desktop a sticky section rail (left) + the active
// sub-page as the detail pane (right). On phone the rail is hidden (rd-d) and the
// sub-page is the full-screen drill-in, with its own back-chevron (SubHeader).
const RAIL: { group: string; items: [string, string, string][] }[] = [
  { group: "Property", items: [["/settings/property", "Property details", "settings"]] },
  { group: "Inventory", items: [["/settings/room-types", "Room types", "bed"], ["/settings/rooms", "Rooms", "door"]] },
  { group: "Channels & sync", items: [["/settings/channels", "Channels", "link"], ["/feeds", "iCal feeds", "link"]] },
  { group: "Pricing", items: [["/settings/pricing", "Pricing rules", "tag"]] },
  { group: "Maintenance", items: [["/settings/blocks", "Blocked dates", "alert"]] },
  { group: "Safety", items: [["/settings/flagged-numbers", "Scam numbers", "alert"]] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="set-md">
      <nav className="set-md__nav rd-d">
        <Link href="/settings" className="display" style={{ fontSize: 20, marginBottom: 10, textDecoration: "none" }}>Settings</Link>
        {RAIL.map((g) => (
          <div key={g.group}>
            <div className="setgroup__label">{g.group}</div>
            {g.items.map(([href, label, icon]) => (
              <Link key={href} href={href} className={`set-md__row${pathname === href ? " on" : ""}`}>
                <span className="setrow__ic"><Icon name={icon} size={16} /></span>{label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="set-md__detail">{children}</div>
    </div>
  );
}
