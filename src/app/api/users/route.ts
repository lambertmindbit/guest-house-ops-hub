import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

// Owner-only (enforced by the middleware for /api/users). Users belong to the
// owner's property.

export async function GET() {
  const session = await getSession();
  const users = await prisma.user.findMany({
    where: session?.propertyId ? { propertyId: session.propertyId } : {},
    select: { id: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return ok(users);
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "password must be at least 8 characters"),
  role: z.enum(["owner", "reception", "housekeeping"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { email, password, role } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash: hashPassword(password), role, propertyId: session?.propertyId ?? null },
    });
    await recordAudit("user.create", "user", user.id, `Added ${user.email} (${user.role})`).catch(() => {});
    return ok({ id: user.id, email: user.email, role: user.role, active: user.active }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("A user with that email already exists.", 409);
    }
    throw error;
  }
}
