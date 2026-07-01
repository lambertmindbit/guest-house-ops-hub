import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { isOwnerOnlyPath, housekeepingCanAccessPage } from "@/lib/authz";

// Gate the whole app behind a valid session, then enforce roles from the signed
// token claims (tamper-proof; no DB at the edge):
//   - non-owner    → blocked from money/config paths (finance/analytics/pricing/
//                    settings/users + their APIs). "Money only for owners."
//   - housekeeping → limited to Today + Cleaning pages; everything else → Today.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await readSession(token);
  if (!claims) return NextResponse.redirect(new URL("/login", request.url));

  const path = request.nextUrl.pathname;
  const home = new URL("/", request.url);

  if (claims.role !== "owner" && isOwnerOnlyPath(path)) {
    return NextResponse.redirect(home);
  }
  if (claims.role === "housekeeping" && !path.startsWith("/api/") && !housekeepingCanAccessPage(path)) {
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except the login page, auth endpoints, Next internals, and
    // the PWA/static files.
    "/((?!login|api/auth|api/ical|api/cron|api/ingest|api/agent|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)",
  ],
};
