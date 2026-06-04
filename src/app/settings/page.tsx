import Link from "next/link";
import { Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

// The Settings hub: a grouped list of categories → each opens a focused
// sub-page (real route, so Back and deep-links work).
const GROUPS = [
  { group: "Property", items: [{ key: "property", title: "Property details", sub: "Name, address, GST, check-in/out times", icon: "settings" }] },
  {
    group: "Inventory",
    items: [
      { key: "room-types", title: "Room types", sub: "Categories, rates, occupancy", icon: "bed" },
      { key: "rooms", title: "Rooms", sub: "Add, archive, remove rooms", icon: "door" },
    ],
  },
  { group: "Channels", items: [{ key: "channels", title: "Channels", sub: "Booking sources & commission", icon: "link" }] },
  { group: "Pricing", items: [{ key: "pricing", title: "Pricing rules", sub: "Weekend, season, lead-time, occupancy", icon: "tag" }] },
  { group: "Maintenance", items: [{ key: "blocks", title: "Blocked dates", sub: "Hold rooms out of service", icon: "alert" }] },
];

export default function SettingsPage() {
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <div className="pagehead">
          <div className="display">Settings</div>
          <div className="pagehead__sub">Manage your property, rooms, channels and pricing.</div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.group} className="setgroup">
            <div className="setgroup__label">{g.group}</div>
            <div className="setlist">
              {g.items.map((it) => (
                <Link key={it.key} href={`/settings/${it.key}`} className="setrow">
                  <span className="setrow__ic"><Icon name={it.icon} size={17} /></span>
                  <span className="setrow__main">
                    <span className="setrow__t">{it.title}</span>
                    <span className="setrow__d">{it.sub}</span>
                  </span>
                  <Icon name="chevronR" size={18} className="setrow__chev" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
