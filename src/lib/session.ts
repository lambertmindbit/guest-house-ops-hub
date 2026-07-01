import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession, type SessionClaims } from "@/lib/auth";
import type { Role } from "@/lib/authz";

// Server-only helpers (Server Components + Node route handlers) to read the
// signed session and enforce roles. RBAC facts come from the token claims — no
// DB round-trip needed for gating.

export async function getSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSession(token);
}

export async function currentRole(): Promise<Role> {
  return (await getSession())?.role ?? "owner";
}

// Redirect to Today unless the session role is allowed. Use at the top of
// owner-only pages as a belt-and-suspenders alongside the middleware gate.
export async function requireRole(allowed: Role[]): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!allowed.includes(session.role)) redirect("/");
  return session;
}
