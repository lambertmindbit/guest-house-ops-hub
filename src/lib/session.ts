import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession, type SessionClaims } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/authz";

// Server-only helpers (Server Components + Node route handlers) to read the
// signed session and enforce roles. The Edge middleware gates coarsely off the
// token claims (no DB at the edge); this Node-layer check is the AUTHORITATIVE
// one — it re-reads the user so disabling an account or changing its role takes
// effect immediately, without waiting for the cookie to expire.

export async function getSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readSession(token);
  if (!claims) return null;
  // One indexed lookup per request. User is not tenant-scoped, so this is a
  // plain by-id read on the default client.
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { active: true, role: true },
  });
  if (!user || !user.active) return null; // disabled/deleted → the session is dead
  return { ...claims, role: user.role }; // DB role wins over the (possibly stale) token
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
