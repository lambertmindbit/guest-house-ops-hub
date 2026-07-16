import Link from "next/link";
import { Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

// The Settings hub ("Property setup") — the single Setup door. A grouped list of
// categories → each opens a focused sub-page (real route, so Back and deep-links
// work). `href` overrides the default `/settings/<key>` (used for iCal feeds,
// which lives at /feeds).
type SetItem = { key: string; title: string; sub: string; icon: string; href?: string };
const GROUPS: { group: string; items: SetItem[] }[] = [
  {
    group: "Property",
    items: [
      { key: "properties", title: "Properties", sub: "Add a property, or switch between the ones you run", icon: "layers" },
      { key: "property", title: "Property details", sub: "Name, address, GST, check-in/out times", icon: "settings" },
      { key: "faq", title: "Guest FAQ", sub: "Answers the chat assistant gives guests (parking, wifi, check-in…)", icon: "help" },
      { key: "assistant-rules", title: "Assistant rules", sub: "Guidance the chat assistant follows (bookings, cancellations, tone)", icon: "inbox" },
    ],
  },
  {
    group: "Inventory",
    items: [
      { key: "room-types", title: "Room types", sub: "Categories, rates, occupancy", icon: "bed" },
      { key: "rooms", title: "Rooms", sub: "Add, archive, remove rooms", icon: "door" },
      { key: "amenities", title: "Amenities", sub: "Facilities on the property & per room type", icon: "box" },
    ],
  },
  {
    group: "Channels & sync",
    items: [
      { key: "channels", title: "Channels", sub: "Booking sources & commission", icon: "link" },
      { key: "agents", title: "Travel agents", sub: "Verified B2B agents, commission & what you owe", icon: "guests" },
      { key: "feeds", title: "iCal feeds", sub: "Sync availability with OTAs", icon: "link" },
    ],
  },
  { group: "Pricing", items: [{ key: "pricing", title: "Pricing rules", sub: "Weekend, season, lead-time, occupancy", icon: "tag" }] },
  { group: "Bookings", items: [{ key: "cancellation", title: "Cancellation & refunds", sub: "Free-cancellation windows (normal / peak)", icon: "receipt" }] },
  { group: "Maintenance", items: [{ key: "blocks", title: "Blocked dates", sub: "Hold rooms out of service", icon: "alert" }] },
  {
    group: "Safety",
    items: [
      { key: "flagged-numbers", title: "Scam / flagged numbers", sub: "Warn at booking if a phone is known bad", icon: "alert" },
      { key: "scam-network", title: "Community scam list", sub: "Verified, shared scam numbers across your network", icon: "alert" },
      { key: "bad-guests", title: "Bad-guest alerts", sub: "Evidence-backed alerts shared with your network", icon: "alert" },
    ],
  },
  { group: "Team", items: [{ key: "users", title: "Users & roles", sub: "Logins for owner / reception / housekeeping", icon: "guests" }] },
  { group: "Community", items: [{ key: "network", title: "Trusted network", sub: "Connect with nearby properties & choose what to share", icon: "link" }] },
  { group: "Data", items: [{ key: "import", title: "Import data", sub: "Bring guests & bookings over from CSV", icon: "inbox" }] },
  { group: "Security", items: [{ key: "audit", title: "Audit log", sub: "Who did what — sensitive actions", icon: "alert" }] },
];

export default function SettingsPage() {
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <div className="pagehead rd-m">
          <div className="display">Settings</div>
          <div className="pagehead__sub">Manage your property, rooms, channels and pricing.</div>
        </div>
        {/* Desktop: the master/detail rail (left) is the menu — show a hint here. */}
        <div className="rd-d empty" style={{ marginTop: 8 }}>Select a section from the left to manage it.</div>
        <div className="rd-m">
        {GROUPS.map((g) => (
          <div key={g.group} className="setgroup">
            <div className="setgroup__label">{g.group}</div>
            <div className="setlist">
              {g.items.map((it) => (
                <Link key={it.key} href={it.href ?? `/settings/${it.key}`} className="setrow">
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
      </div>
    </main>
  );
}
