import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE, readSession, type SessionClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/authz";

// Server-only helpers (Server Components + Node route handlers) to read the
// signed session and enforce roles. The Edge middleware gates coarsely off the
// token claims (no DB at the edge); this Node-layer check is the AUTHORITATIVE
// one — it re-reads the user so disabling an account or changing its role takes
// effect immediately, without waiting for the cookie to expire.

/** The signed claims, plus the facts we re-read from the database each request. */
export type Viewer = SessionClaims & { isPlatformAdmin: boolean };

export async function getSession(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readSession(token);
  if (!claims) return null;
  // One indexed lookup per request. User is not tenant-scoped, so this is a
  // plain by-id read on the default client.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { active: true, role: true, isPlatformAdmin: true },
  });
  if (!user || !user.active) return null; // disabled/deleted → the session is dead
  // The DB wins over the (possibly stale) token — for the role, and for platform
  // admin. Deliberately NOT a cookie claim: revoking it must take effect on the
  // next request, not whenever the cookie happens to expire.
  return { ...claims, role: user.role, isPlatformAdmin: user.isPlatformAdmin };
}

// Least privilege when there is no valid session. Callers behind the middleware
// always have a token; a null here means the account was disabled mid-session,
// so we must NOT fall open to owner.
export async function currentRole(): Promise<Role> {
  return (await getSession())?.role ?? "housekeeping";
}

// Redirect to Today unless the session role is allowed. Use at the top of
// owner-only pages as a belt-and-suspenders alongside the middleware gate.
export async function requireRole(allowed: Role[]): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!allowed.includes(session.role)) redirect("/");
  return session;
}

/**
 * The vendor's own console. NOT a role — `role` is what you may do inside a
 * property; this is a separate axis that sits above it.
 *
 * 404s rather than 403s for anyone else, including the client's owner: a client
 * poking at /admin should find nothing there, not a locked door telling them a
 * vendor console exists.
 *
 * This grants no cross-database power. Each client has their own database, so
 * "platform admin" here means "may configure THIS deployment", not "may read
 * every client".
 */
export async function requirePlatformAdmin(): Promise<Viewer> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) notFound();
  return session;
}
