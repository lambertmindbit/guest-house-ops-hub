import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, zodFail, withRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { issueToken } from "@/lib/auth-tokens";
import { sendEmail } from "@/lib/email";

// Public + rate-limited (US-602). ALWAYS returns 200 so it can't be used to probe
// which emails have accounts (no user enumeration). A live account gets a 1-hour,
// single-use reset link by email; in log-only mode the link is in the server log.
const schema = z.object({ email: z.string().email() });
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

async function handlePOST(request: Request) {
  const limit = rateLimit(`reset:${clientIp(request)}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, active: true } });
  if (user?.active) {
    const token = await issueToken({ kind: "password_reset", email, userId: user.id });
    const link = `${new URL(request.url).origin}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your Guest House Ops Hub password",
      text: `Reset your password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    });
  }

  return ok({ ok: true }); // identical response whether or not the account exists
}

export const POST = withRoute(handlePOST);
