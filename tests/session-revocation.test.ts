import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// US-603: a disabled account or a role change takes effect on the NEXT request,
// because getSession re-reads active + role from the DB rather than trusting the
// (possibly stale) cookie. We drive getSession with a mocked cookie jar.
const holder = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "ota_session" && holder.token ? { value: holder.token } : undefined) }),
}));

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createSessionToken } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const STAMP = Date.now();
const EMAIL = `rev${STAMP}@x.test`;
let userId: string;

beforeAll(async () => {
  process.env.AUTH_SECRET ||= "test-secret-revocation";
  const u = await prisma.user.create({ data: { email: EMAIL, passwordHash: hashPassword("password"), role: "reception" } });
  userId = u.id;
  // A cookie minted while they were reception — deliberately stale by the end.
  holder.token = await createSessionToken({ sub: u.id, role: "reception", propertyId: null });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe("session revocation (US-603)", () => {
  it("resolves a live session with the DB role", async () => {
    expect((await getSession())?.role).toBe("reception");
  });

  it("returns the FRESH role after a role change, ignoring the stale cookie", async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: "owner" } });
    expect((await getSession())?.role).toBe("owner");
  });

  it("kills the session the moment the account is disabled", async () => {
    await prisma.user.update({ where: { id: userId }, data: { active: false } });
    expect(await getSession()).toBeNull();
  });
});
