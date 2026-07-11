// Role-based access — the single source of truth for who can reach what. Pure
// string logic (no DB, no node APIs) so it's safe to import in the Edge
// middleware AND in server components / the client NavShell.

export type Role = "owner" | "reception" | "housekeeping";

// Path prefixes only the OWNER may reach: money (finance/analytics/pricing) +
// config/admin APIs. Deliberately excludes operational APIs that staff need
// (e.g. /api/rooms, used by the housekeeping "mark clean" action).
const OWNER_ONLY_PREFIXES = [
  "/finance", "/analytics", "/pricing", "/settings", "/users",
  "/api/pricing", "/api/settings", "/api/seasons", "/api/expenses",
  "/api/flagged-numbers", "/api/users", "/api/import", "/api/id-documents",
  // Money data endpoints — same "money only for owners" rule as the pages above.
  // Easy to miss: the page path (/analytics, /finance) differs from the API path,
  // so these must be listed explicitly or a non-owner could fetch the CSVs directly.
  "/api/analytics", "/api/export",
  // The in-app assistant IS the owner console: it always runs the owner agent,
  // which exposes finance/summary tools. So both the page and its transport are
  // owner-only, same as the Finance/Analytics screens — otherwise reception (or
  // housekeeping, via a direct call) could read revenue through the assistant.
  "/assistant", "/api/assistant",
  // iCal feed config + on-demand sync trigger a server-side fetch of an
  // owner-supplied URL. Keep that owner-only (and see assertPublicHttpUrl, which
  // blocks internal targets regardless of who calls).
  "/api/feeds", "/api/sync",
  // Community sharing config is the owner's call (later slices may open specific
  // sub-paths like referrals to reception). Scam reporting is owner-only too.
  "/api/community/connections", "/api/community/sharing", "/api/community/scam",
  "/api/community/guest-alerts",
];

export function isOwnerOnlyPath(pathname: string): boolean {
  return OWNER_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Housekeeping is limited to Today + Cleaning (pages). API calls their UI makes
// (mark clean, auth) are allowed; everything else redirects to Today.
const HOUSEKEEPING_PAGES = ["/housekeeping", "/help", "/more"];

export function housekeepingCanAccessPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return HOUSEKEEPING_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// APIs housekeeping's own screens actually call: mark-a-room-clean (/api/rooms),
// housekeeping tasks, and the nav property switcher (/api/session). Everything
// else is out of its scope, so a direct call is refused — the API is the real
// trust boundary, not just which buttons the UI renders. (auth is exempt from the
// middleware matcher entirely, so it needs no entry here.)
const HOUSEKEEPING_APIS = ["/api/rooms", "/api/housekeeping", "/api/session"];

export function housekeepingCanAccessApi(pathname: string): boolean {
  return HOUSEKEEPING_APIS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Nav visibility (drives NavShell): which nav ids a role may see. The Owner
// console (assistant) is owner-only — it speaks the property's finances.
const RECEPTION_HIDDEN = new Set(["finance", "analytics", "pricing", "settings", "assistant"]);
const HOUSEKEEPING_VISIBLE = new Set(["today", "housekeeping", "help"]);

export function canSeeNav(role: Role, navId: string): boolean {
  if (role === "owner") return true;
  if (role === "housekeeping") return HOUSEKEEPING_VISIBLE.has(navId);
  return !RECEPTION_HIDDEN.has(navId); // reception
}

// Coarse capability check for server guards / conditional UI (e.g. hide money).
export function canSeeMoney(role: Role): boolean {
  return role === "owner";
}
