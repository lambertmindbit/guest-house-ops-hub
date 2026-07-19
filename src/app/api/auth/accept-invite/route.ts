import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, zodFail, withRoute } from "@/lib/api";
import { findLiveToken, consumeToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

// Public (under /api/auth, excluded from the auth gate). The invitee sets their
// password; we create the account with the invite's pre-assigned role/property,
// consume the single-use token, and log them straight in.
const schema = z.object({ token: z.string().min(1), password: z.string().min(8, "password must be at least 8 characters") });

async function handlePOST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { token, password } = parsed.data;

  const invite = await findLiveToken(token, "invite");
  if (!invite) return fail("This invite link is invalid or has expired.", 400);

  // Guard the race where the email was registered after the invite was sent.
  if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
    await consumeToken(invite.id);
    return fail("An account with this email already exists. Use password reset.", 409);
  }

  const user = await prisma.user.create({
    data: { email: invite.email, passwordHash: hashPassword(password), role: invite.role ?? "reception", propertyId: invite.propertyId },
  });
  if (invite.propertyId) {
    await prisma.userProperty.create({ data: { userId: user.id, propertyId: invite.propertyId } }).catch(() => {});
  }
  await consumeToken(invite.id);
  await recordAudit("user.create", "user", user.id, `Accepted invite: ${user.email} (${user.role})`).catch(() => {});

  const sessionToken = await createSessionToken({ sub: user.id, role: user.role, propertyId: user.propertyId });
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions);
  return response;
}

export const POST = withRoute(handlePOST);
