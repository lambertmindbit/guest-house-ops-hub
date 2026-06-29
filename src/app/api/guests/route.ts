import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";

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

// Nullable date field: accepts a YYYY-MM-DD string or null/undefined.
const optDate = dateOnly.nullable().optional();

// C-Form fields shared between create and update.
const cformFields = {
  nationality: z.string().trim().nullable().optional(),
  passportNumber: z.string().trim().nullable().optional(),
  passportIssueDate: optDate,
  passportIssuePlace: z.string().trim().nullable().optional(),
  passportExpiry: optDate,
  visaNumber: z.string().trim().nullable().optional(),
  visaType: z.string().trim().nullable().optional(),
  visaIssueDate: optDate,
  visaIssuePlace: z.string().trim().nullable().optional(),
  visaExpiry: optDate,
  portOfEntry: z.string().trim().nullable().optional(),
  arrivalInIndia: optDate,
  purposeOfVisit: z.string().trim().nullable().optional(),
};

// Map YYYY-MM-DD strings to Date objects for the date fields.
function parseCformDates(d: {
  passportIssueDate?: string | null;
  passportExpiry?: string | null;
  visaIssueDate?: string | null;
  visaExpiry?: string | null;
  arrivalInIndia?: string | null;
}) {
  return {
    passportIssueDate: d.passportIssueDate ? parseDateOnly(d.passportIssueDate) : d.passportIssueDate,
    passportExpiry: d.passportExpiry ? parseDateOnly(d.passportExpiry) : d.passportExpiry,
    visaIssueDate: d.visaIssueDate ? parseDateOnly(d.visaIssueDate) : d.visaIssueDate,
    visaExpiry: d.visaExpiry ? parseDateOnly(d.visaExpiry) : d.visaExpiry,
    arrivalInIndia: d.arrivalInIndia ? parseDateOnly(d.arrivalInIndia) : d.arrivalInIndia,
  };
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
  ...cformFields,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const { passportIssueDate, passportExpiry, visaIssueDate, visaExpiry, arrivalInIndia, ...rest } =
    parsed.data;

  try {
    const guest = await prisma.guest.create({
      data: { ...rest, ...parseCformDates({ passportIssueDate, passportExpiry, visaIssueDate, visaExpiry, arrivalInIndia }) },
    });
    return ok(guest, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("A guest with that phone already exists — search for them instead.", 409);
    }
    throw error;
  }
}
