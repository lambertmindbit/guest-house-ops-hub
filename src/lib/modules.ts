// Which modules a property gets — the single source of truth for module visibility.
//
// The vendor (a platform admin) decides per property. The client's own owner
// cannot: what you bought is not something you grant yourself.
//
// Storage is a DISABLED list, not an enabled one (PropertySettings.disabledModules).
// That matters: an empty array — and therefore every existing property and every
// new one — shows the whole product. An "enabled" list would make a fresh property
// default to a blank app, and the first mistake would be an invisible one.

/** A module the vendor may switch off for a property. */
export type ModuleId =
  | "groups"
  | "maintenance"
  | "inventory"
  | "vendors"
  | "transport"
  | "tours"
  | "complaints"
  | "staff"
  | "inbox"
  | "messages"
  | "reviews"
  | "partners"
  | "referrals"
  | "directory"
  | "assistant";

export type ModuleDef = {
  id: ModuleId;
  label: string;
  /** One line the vendor reads while deciding. Written for a salesperson, not a dev. */
  blurb: string;
  /** Page routes this module owns. A disabled module 404s these. */
  routes: string[];
  group: "Operate" | "Facilities" | "Review" | "Partners" | "AI";
};

/**
 * Everything that CAN be switched off.
 *
 * Note what is absent: today, calendar, bookings, guests, housekeeping, needs-you,
 * finance, pricing, analytics, settings. Those are the product. They are not
 * listed here, so they can never be disabled — see isCore().
 */
export const MODULES: ModuleDef[] = [
  { id: "groups", label: "Groups", blurb: "Group and long-stay bookings across several rooms.", routes: ["/groups"], group: "Operate" },
  { id: "complaints", label: "Complaints", blurb: "Log and resolve guest complaints; spot patterns.", routes: ["/complaints"], group: "Operate" },
  { id: "staff", label: "Staff", blurb: "Staff directory, roster and attendance.", routes: ["/staff"], group: "Operate" },
  { id: "assistant", label: "AI assistant", blurb: "Guest chat and the owner console. Needs the agent service running.", routes: ["/assistant", "/chat"], group: "AI" },

  { id: "maintenance", label: "Maintenance", blurb: "Report a broken item, track it to fixed; asset register.", routes: ["/maintenance"], group: "Facilities" },
  { id: "inventory", label: "Inventory", blurb: "Stock levels and movements for consumables.", routes: ["/inventory"], group: "Facilities" },
  { id: "vendors", label: "Vendors", blurb: "Supplier directory, purchase orders, dues.", routes: ["/vendors"], group: "Facilities" },
  { id: "transport", label: "Transport", blurb: "Driver directory and trip records.", routes: ["/transport"], group: "Facilities" },
  { id: "tours", label: "Tours", blurb: "Tour partners, tours and tour bookings.", routes: ["/tours"], group: "Facilities" },

  { id: "inbox", label: "Inbox", blurb: "Paste an OTA confirmation email → review → create the booking.", routes: ["/inbox"], group: "Review" },
  { id: "messages", label: "Messages", blurb: "Outbox for guest messages. Sends nothing until a provider is wired.", routes: ["/messages"], group: "Review" },
  { id: "reviews", label: "Reviews", blurb: "Review tracker and response drafts.", routes: ["/reviews"], group: "Review" },

  { id: "partners", label: "Partners", blurb: "Directory of nearby properties, drivers and agents.", routes: ["/partners"], group: "Partners" },
  { id: "referrals", label: "Referrals", blurb: "Overflow referrals and the reciprocal-credit ledger.", routes: ["/referrals"], group: "Partners" },
  { id: "directory", label: "Community network", blurb: "Peer directory, shared availability, scam and bad-guest alerts. Worth nothing until other properties are on it.", routes: ["/directory", "/directories"], group: "Partners" },
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

/**
 * Is this a module the vendor is allowed to switch off?
 *
 * Anything not in MODULES is CORE — Today, Calendar, Bookings, Guests,
 * Housekeeping, Needs you, Finance, Pricing, Analytics, Settings. A stray or
 * malicious id in the database therefore cannot hide the calendar; the worst it
 * can do is nothing.
 */
export function isToggleable(id: string): id is ModuleId {
  return BY_ID.has(id as ModuleId);
}

/** Disabled ids, ignoring anything that isn't a real toggleable module. */
export function disabledSet(disabled: readonly string[]): Set<ModuleId> {
  return new Set(disabled.filter(isToggleable));
}

export function isModuleEnabled(id: ModuleId, disabled: readonly string[]): boolean {
  return !disabledSet(disabled).has(id);
}

/**
 * The module that owns a page route, or null when the route is core.
 *
 * Matches on a path segment boundary so `/inventory` owns `/inventory/abc` but
 * `/inventoryX` — or a future `/inventory-report` — is not swept up by accident.
 */
export function moduleForRoute(pathname: string): ModuleId | null {
  for (const m of MODULES) {
    for (const r of m.routes) {
      if (pathname === r || pathname.startsWith(`${r}/`)) return m.id;
    }
  }
  return null;
}
