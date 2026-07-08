import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHousekeeping } from "@/lib/housekeeping";
import { getConflicts } from "@/lib/conflicts";
import { escalationStats } from "@/lib/escalations";
import { Icon } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

// The phone "More" hub — everything off the bottom bar, grouped (not a wall of
// links). Desktop never routes here (the sidebar owns these); it's reachable
// only via the phone More tab, so we render the phone layout unconditionally.

type Row = { href: string; icon: string; title: string; sub: string; badge?: number };

export default async function MorePage() {
  const [hk, conflicts, esc, inboxCount] = await Promise.all([
    getHousekeeping(),
    getConflicts(),
    escalationStats(),
    prisma.inboundBooking.count({ where: { status: "pending" } }),
  ]);
  const needsYou = conflicts.length + esc.openTotal;

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: "Operate",
      rows: [
        { href: "/groups", icon: "layers", title: "Booking groups", sub: "One folio for several rooms" },
        { href: "/guests", icon: "guests", title: "Guests", sub: "Directory & lookup" },
        { href: "/housekeeping", icon: "clean", title: "Housekeeping", sub: hk.toCleanCount > 0 ? `${hk.toCleanCount} room${hk.toCleanCount === 1 ? "" : "s"} to clean` : "All rooms clean" },
        { href: "/complaints", icon: "alertCircle", title: "Complaints", sub: "Log & resolve guest issues" },
        { href: "/staff", icon: "guests", title: "Staff", sub: "Directory, shifts & attendance" },
        { href: "/assistant", icon: "inbox", title: "Owner console", sub: "Ask about your day; book, block, resolve" },
        { href: "/needs-you", icon: "alert", title: "Needs you", sub: "Conflicts & approvals", badge: needsYou },
      ],
    },
    {
      label: "Facilities",
      rows: [
        { href: "/maintenance", icon: "wrench", title: "Maintenance", sub: "Requests, assets & service" },
        { href: "/inventory", icon: "box", title: "Inventory", sub: "Supplies & low-stock" },
        { href: "/vendors", icon: "receipt", title: "Vendors", sub: "Directory, POs & payments" },
        { href: "/transport", icon: "truck", title: "Transport", sub: "Drivers & trips" },
      ],
    },
    {
      label: "Partners",
      rows: [
        { href: "/partners", icon: "search", title: "Partners", sub: "Places & people you work with" },
        { href: "/referrals", icon: "layers", title: "Referrals", sub: "Guests you sent to a partner" },
      ],
    },
    {
      label: "Business",
      rows: [
        { href: "/finance", icon: "wallet", title: "Finance", sub: "Revenue & balances" },
        { href: "/pricing", icon: "tag", title: "Pricing", sub: "Advisory rates" },
        { href: "/analytics", icon: "chart", title: "Analytics", sub: "Occupancy & ADR" },
      ],
    },
    {
      label: "Review",
      rows: [
        { href: "/inbox", icon: "inbox", title: "Inbox", sub: inboxCount > 0 ? `${inboxCount} OTA email${inboxCount === 1 ? "" : "s"} to confirm` : "OTA confirmations" },
        { href: "/messages", icon: "inbox", title: "Messages", sub: "Guest message log" },
        { href: "/reviews", icon: "star", title: "Reviews", sub: "Requests & responses" },
        { href: "/escalations", icon: "alert", title: "Escalations", sub: "Assistant approvals queue", badge: esc.openTotal },
      ],
    },
    {
      label: "Setup",
      rows: [
        { href: "/settings", icon: "settings", title: "Property setup", sub: "Rooms, channels, pricing, blocked dates, scam list, sync" },
      ],
    },
  ];

  return (
    <main className="app-main">
      <div className="entrance">
        <div className="pagehead">
          <div className="display">More</div>
          <div className="pagehead__sub">Everything else — grouped, not a wall of links.</div>
        </div>

        {groups.map((g) => (
          <div key={g.label} className="setgroup">
            <div className="setgroup__label">{g.label}</div>
            <div className="setlist">
              {g.rows.map((r) => (
                <Link key={r.href} href={r.href} className="setrow">
                  <span className="setrow__ic"><Icon name={r.icon} size={17} /></span>
                  <span className="setrow__main">
                    <span className="setrow__t">{r.title}</span>
                    <span className="setrow__d">{r.sub}</span>
                  </span>
                  {r.badge ? <span className="navitem__badge" style={{ marginRight: 8 }}>{r.badge}</span> : null}
                  <Icon name="chevronR" size={18} className="setrow__chev" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="setgroup">
          <div className="setgroup__label">System</div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/help" className="btn btn--ghost" style={{ flex: 1 }}>
              <Icon name="help" size={15} /> Help
            </Link>
            <LogoutButton />
          </div>
          <p className="faint" style={{ fontSize: "var(--fs-meta)", marginTop: 8 }}>
            Appearance, accent and density are in the <Icon name="settings" size={12} /> menu, top-right.
          </p>
        </div>
      </div>
    </main>
  );
}
