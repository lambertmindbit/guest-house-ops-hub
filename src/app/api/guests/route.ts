import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";

const schema = z.object({ q: z.string().optional() });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ q: searchParams.get("q") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);
  const q = parsed.data.q?.trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return ok(guests);
}

// Create a guest directly (e.g. to pre-register or pre-blacklist someone who
// hasn't booked yet). Phone is the unique key; bookings upsert by it.
const createSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().min(3, "phone is required"),
  email: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  blocked: z.boolean().optional(),
  blockReason: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const guest = await prisma.guest.create({ data: parsed.data });
    return ok(guest, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("A guest with that phone already exists — search for them instead.", 409);
    }
    throw error;
  }
}
