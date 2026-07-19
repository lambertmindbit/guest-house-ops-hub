import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { issueToken } from "@/lib/auth-tokens";
import { sendEmail } from "@/lib/email";
import { recordAudit } from "@/lib/audit";

// Owner-only (the /api/users prefix is owner-gated by the middleware). Invites a
// new staff member with a pre-assigned role + property; they set their own
// password via the emailed link (GAP-10 / US-601). No password is set here.
const schema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "reception", "housekeeping"]),
  propertyId: z.string().min(1).optional(),
});

async function handlePOST(request: Request) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { email, role, propertyId } = parsed.data;

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return fail("A user with that email already exists.", 409);
  }

  const grantProperty = propertyId ?? session?.propertyId ?? null;
  const token = await issueToken({ kind: "invite", email, role, propertyId: grantProperty });
  const link = `${new URL(request.url).origin}/accept-invite?token=${token}`;

  await sendEmail({
    to: email,
    subject: "You've been invited to the Guest House Ops Hub",
    text: `You've been invited as ${role}. Set up your account:\n\n${link}\n\nThis link expires in 7 days.`,
  });
  await recordAudit("user.invite", "user", null, `Invited ${email} (${role})`).catch(() => {});

  // Return the link so the owner can copy/send it themselves in log-only mode
  // (no SMTP configured). Owner-gated endpoint, so this exposes nothing new.
  return ok({ invited: email, link }, 201);
}

export const POST = withRoute(handlePOST);
