import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";

// GET  /api/flagged-numbers          — list all flagged numbers
// GET  /api/flagged-numbers?check=X  — quick scam check by phone (returns { flagged, reason })
// POST /api/flagged-numbers          — add a number to the list

const createSchema = z.object({
  phone: z.string().trim().min(3, "phone is required"),
  reason: z.string().trim().min(1).optional(),
});

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("check");

  if (phone) {
    const hit = await prisma.flaggedNumber.findUnique({ where: { phone: phone.trim() } });
    return ok({ flagged: !!hit, reason: hit?.reason ?? null });
  }

  const numbers = await prisma.flaggedNumber.findMany({ orderBy: { createdAt: "desc" } });
  return ok(numbers);
}

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const entry = await prisma.flaggedNumber.create({ data: parsed.data });
    return ok(entry, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("That number is already on the scam list.", 409);
    }
    throw error;
  }
}

export const GET = withRoute(handleGET);
export const POST = withRoute(handlePOST);
