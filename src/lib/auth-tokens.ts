import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { AuthTokenKind, UserRole } from "@prisma/client";

// Single-use, expiring tokens for staff invites + password resets (GAP-10). Only
// the SHA-256 of the plaintext token is stored; the plaintext lives only in the
// emailed link, so a DB leak yields no usable links.

const TTL_MS: Record<AuthTokenKind, number> = {
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
  password_reset: 60 * 60 * 1000, // 1 hour
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Create a token and return the PLAINTEXT (for the link). Never stored.
export async function issueToken(opts: {
  kind: AuthTokenKind;
  email: string;
  userId?: string | null;
  role?: UserRole | null;
  propertyId?: string | null;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: {
      kind: opts.kind,
      tokenHash: hashToken(token),
      email: opts.email,
      userId: opts.userId ?? null,
      role: opts.role ?? null,
      propertyId: opts.propertyId ?? null,
      expiresAt: new Date(Date.now() + TTL_MS[opts.kind]),
    },
  });
  return token;
}

// The row for a live (right kind, unconsumed, unexpired) token, or null.
export async function findLiveToken(token: string, kind: AuthTokenKind) {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.kind !== kind || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function consumeToken(id: string): Promise<void> {
  await prisma.authToken.update({ where: { id }, data: { consumedAt: new Date() } });
}
