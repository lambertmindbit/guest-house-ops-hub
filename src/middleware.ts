import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { isOwnerOnlyPath, housekeepingCanAccessPage, housekeepingCanAccessApi } from "@/lib/authz";

// Gate the whole app behind a valid session, then enforce roles from the signed
// token claims (tamper-proof; no DB at the edge):
//   - non-owner    → blocked from money/config paths (finance/analytics/pricing/
//                    settings/users + their APIs). "Money only for owners."
//   - housekeeping → limited to Today + Cleaning pages AND the few APIs those
//                    screens call; every other page → Today, every other API → 403.
// Token-gated machine seams: no login cookie, their own shared secret. Middleware
// runs on them only to STRIP any client-supplied x-ota-tenant so it can't be
// spoofed into the tenant extension — these routes resolve their own property.
const TOKEN_ROUTES = ["/api/ical", "/api/cron", "/api/ingest", "/api/agent"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (TOKEN_ROUTES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const sanitized = new Headers(request.headers);
    sanitized.delete("x-ota-tenant");
    return NextResponse.next({ request: { headers: sanitized } });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await readSession(token);
  if (!claims) return NextResponse.redirect(new URL("/login", request.url));

  const home = new URL("/", request.url);

  if (claims.role !== "owner" && isOwnerOnlyPath(path)) {
    return NextResponse.redirect(home);
  }
  if (claims.role === "housekeeping") {
    if (path.startsWith("/api/")) {
      // APIs aren't pages — a redirect would hand an API client HTML, so deny hard.
      if (!housekeepingCanAccessApi(path)) {
        return NextResponse.json({ error: "Not allowed for your role." }, { status: 403 });
      }
    } else if (!housekeepingCanAccessPage(path)) {
      return NextResponse.redirect(home);
    }
  }

  // Bind the acting property for downstream Prisma queries. The tenant extension
  // (src/lib/prisma.ts) reads this header to scope every query to the logged-in
  // owner's property. `set` OVERWRITES any client-supplied value, so it cannot be
  // spoofed — the value comes only from the HMAC-verified session claims.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ota-tenant", claims.propertyId ?? "");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Everything except the login page, auth endpoints, the PUBLIC guest chat
    // (page + api — no login by design), Next internals, and the PWA/static files.
    // The token-gated seams (ical/cron/ingest/agent) ARE matched so middleware can
    // strip a spoofed x-ota-tenant; they're handled (no auth, header stripped) at
    // the top of middleware().
    "/((?!login|accept-invite|reset-password|forgot-password|chat|api/auth|api/public|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|offline.html).*)",
  ],
};
