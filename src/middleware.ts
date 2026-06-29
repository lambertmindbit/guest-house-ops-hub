import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Gate the whole app behind the owner session. The matcher below already
// excludes /login, the auth API, and static assets, so anything that reaches
// here must carry a valid session cookie.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Everything except the login page, auth endpoints, Next internals, and
    // the PWA/static files (manifest + icons land in Slice 10).
    "/((?!login|api/auth|api/ical|api/cron|api/ingest|api/agent|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)",
  ],
};
