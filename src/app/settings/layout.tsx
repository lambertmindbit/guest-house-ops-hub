"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

// Settings master/detail: on desktop a sticky section list of cards (left) +
// the active sub-page as the detail pane (right) — matching the redesign
// prototype's .set-md (icon-tile cards, active = .setrow--on, title only). On
// phone the list is hidden (rd-d) and the sub-page is the full-screen drill-in
// with its own back-chevron (SubHeader).
const RAIL: { group: string; items: [string, string, string][] }[] = [
  { group: "Property", items: [["/settings/properties", "Properties", "layers"], ["/settings/property", "Property details", "settings"], ["/settings/faq", "Guest FAQ", "help"], ["/settings/assistant-rules", "Assistant rules", "inbox"]] },
  { group: "Inventory", items: [["/settings/room-types", "Room types", "bed"], ["/settings/rooms", "Rooms", "door"], ["/settings/amenities", "Amenities", "box"]] },
  { group: "Channels & sync", items: [["/settings/channels", "Channels", "link"], ["/settings/feeds", "iCal feeds", "link"]] },
  { group: "Pricing", items: [["/settings/pricing", "Pricing rules", "tag"]] },
  { group: "Bookings", items: [["/settings/cancellation", "Cancellation & refunds", "receipt"]] },
  { group: "Maintenance", items: [["/settings/blocks", "Blocked dates", "alert"]] },
  { group: "Safety", items: [["/settings/flagged-numbers", "Scam numbers", "alert"]] },
  { group: "Team", items: [["/settings/users", "Users & roles", "guests"]] },
  { group: "Data", items: [["/settings/import", "Import data", "inbox"]] },
  { group: "Security", items: [["/settings/audit", "Audit log", "alert"]] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="set-md">
      <div className="set-md__list rd-d">
        <div className="display" style={{ fontSize: "var(--fs-h2)", marginBottom: 12 }}>Settings</div>
        {RAIL.map((g) => (
          <div key={g.group} className="setgroup">
            <div className="setgroup__label">{g.group}</div>
            <div className="setlist">
              {g.items.map(([href, label, icon]) => (
                <Link key={href} href={href} className={`setrow${pathname === href ? " setrow--on" : ""}`}>
                  <span className="setrow__ic"><Icon name={icon} size={17} /></span>
                  <span className="setrow__main"><span className="setrow__t">{label}</span></span>
                  <Icon name="chevronR" size={16} className="setrow__chev" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="set-md__detail">{children}</div>
    </div>
  );
}
