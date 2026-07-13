import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { isLastActiveOwner } from "@/lib/users";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

const schema = z
  .object({
    role: z.enum(["owner", "reception", "housekeeping"]).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8, "password must be at least 8 characters").optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { role, active, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return fail("user not found", 404);

  // Block a change that would remove the last active owner.
  const losesOwner = (role !== undefined && role !== "owner") || active === false;
  if (losesOwner && (await isLastActiveOwner(id))) {
    return fail("This is the last owner — add another owner before changing this account.", 409);
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(password !== undefined ? { passwordHash: hashPassword(password) } : {}),
    },
    select: { id: true, email: true, role: true, active: true },
  });
  return ok(user);
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (session?.sub === id) return fail("You can't delete your own account.", 400);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return fail("user not found", 404);
  if (await isLastActiveOwner(id)) return fail("This is the last owner — add another owner before removing this account.", 409);
  await prisma.user.delete({ where: { id } });
  await recordAudit("user.delete", "user", id, `Removed ${existing.email}`).catch(() => {});
  return ok({ deleted: true });
}

export const PATCH = withRoute(handlePATCH);
export const DELETE = withRoute(handleDELETE);
