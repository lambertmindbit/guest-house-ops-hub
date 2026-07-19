import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { findLiveToken, consumeToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

// Public (under /api/auth). Consumes a single-use reset token and sets the new
// password. The token is invalidated immediately so the link can't be reused.
const schema = z.object({ token: z.string().min(1), password: z.string().min(8, "password must be at least 8 characters") });

async function handlePOST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { token, password } = parsed.data;

  const reset = await findLiveToken(token, "password_reset");
  if (!reset || !reset.userId) return fail("This reset link is invalid or has expired.", 400);

  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(password) } });
  await consumeToken(reset.id);
  await recordAudit("user.password-reset", "user", reset.userId, "Password reset via email link").catch(() => {});

  return ok({ ok: true });
}

export const POST = withRoute(handlePOST);
