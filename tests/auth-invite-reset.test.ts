import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The invite route reads the owner's session; cookies() throws outside a request.
vi.mock("@/lib/session", () => ({ getSession: async () => null }));

import { prisma } from "@/lib/prisma";
import { POST as invite } from "@/app/api/users/invite/route";
import { POST as acceptInvite } from "@/app/api/auth/accept-invite/route";
import { POST as resetRequest } from "@/app/api/auth/reset-request/route";
import { POST as reset } from "@/app/api/auth/reset/route";
import { issueToken } from "@/lib/auth-tokens";
import { hashPassword, verifyPassword } from "@/lib/password";

beforeAll(() => {
  process.env.AUTH_SECRET ||= "test-secret-invite-reset";
});

const STAMP = Date.now();
const INV_EMAIL = `inv${STAMP}@x.test`;
const RST_EMAIL = `rst${STAMP}@x.test`;
let propertyId: string;

const req = (url: string, body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify(body) });

beforeAll(async () => {
  const p = await prisma.propertySettings.create({ data: { name: `invtest-${STAMP}` } });
  propertyId = p.id;
});

afterAll(async () => {
  await prisma.authToken.deleteMany({ where: { email: { in: [INV_EMAIL, RST_EMAIL] } } });
  const users = await prisma.user.findMany({ where: { email: { in: [INV_EMAIL, RST_EMAIL] } }, select: { id: true } });
  await prisma.userProperty.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { email: { in: [INV_EMAIL, RST_EMAIL] } } });
  await prisma.propertySettings.deleteMany({ where: { name: `invtest-${STAMP}` } });
  await prisma.$disconnect();
});

describe("staff invite → accept (US-601)", () => {
  it("creates a link; accepting creates the user with the pre-assigned role + property and consumes the token", async () => {
    const res = await invite(req("http://localhost/api/users/invite", { email: INV_EMAIL, role: "reception", propertyId }));
    expect(res.status).toBe(201);
    const link: string = (await res.json()).data.link;
    const token = new URL(link).searchParams.get("token");
    expect(token).toBeTruthy();

    const acc = await acceptInvite(req("http://localhost/api/auth/accept-invite", { token, password: "supersecret" }));
    expect(acc.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: INV_EMAIL } });
    expect(user?.role).toBe("reception");
    expect(user?.propertyId).toBe(propertyId);
    expect(verifyPassword("supersecret", user!.passwordHash)).toBe(true);
    expect(await prisma.userProperty.findFirst({ where: { userId: user!.id, propertyId } })).toBeTruthy();

    // Single-use: the link can't be replayed.
    const again = await acceptInvite(req("http://localhost/api/auth/accept-invite", { token, password: "supersecret2" }));
    expect(again.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const bad = await acceptInvite(req("http://localhost/api/auth/accept-invite", { token: "not-a-real-token", password: "supersecret" }));
    expect(bad.status).toBe(400);
  });
});

describe("password reset (US-602)", () => {
  it("reset-request stores a token and returns a generic 200 (no enumeration); reset changes the password, single-use", async () => {
    const user = await prisma.user.create({ data: { email: RST_EMAIL, passwordHash: hashPassword("oldpassword"), role: "reception" } });

    const rr = await resetRequest(req("http://localhost/api/auth/reset-request", { email: RST_EMAIL }));
    expect(rr.status).toBe(200);
    expect(await prisma.authToken.findFirst({ where: { email: RST_EMAIL, kind: "password_reset", consumedAt: null } })).toBeTruthy();
    // Same 200 for an unknown email (can't probe accounts).
    expect((await resetRequest(req("http://localhost/api/auth/reset-request", { email: `nobody${STAMP}@x.test` }))).status).toBe(200);

    // reset-request only stores the hash; issue our own token to drive the reset route.
    const token = await issueToken({ kind: "password_reset", email: RST_EMAIL, userId: user.id });
    const rz = await reset(req("http://localhost/api/auth/reset", { token, password: "newpassword" }));
    expect(rz.status).toBe(200);
    expect(verifyPassword("newpassword", (await prisma.user.findUnique({ where: { id: user.id } }))!.passwordHash)).toBe(true);

    const rz2 = await reset(req("http://localhost/api/auth/reset", { token, password: "yetanother" }));
    expect(rz2.status).toBe(400); // single-use
  });
});
