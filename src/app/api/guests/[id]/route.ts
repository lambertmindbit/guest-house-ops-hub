import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { syncBlacklistToScamList } from "@/lib/blacklist-sync";

const optDate = dateOnly.nullable().optional();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().nullable().optional(),
    idNumber: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    blocked: z.boolean().optional(),
    blockReason: z.string().nullable().optional(),
    // C-Form fields
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
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "no fields to update" });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await prisma.guest.findUnique({ where: { id } });
  if (!existing) return fail("guest not found", 404);

  const {
    passportIssueDate,
    passportExpiry,
    visaIssueDate,
    visaExpiry,
    arrivalInIndia,
    ...rest
  } = parsed.data;

  const parsedDates = {
    ...(passportIssueDate !== undefined && {
      passportIssueDate: passportIssueDate ? parseDateOnly(passportIssueDate) : null,
    }),
    ...(passportExpiry !== undefined && {
      passportExpiry: passportExpiry ? parseDateOnly(passportExpiry) : null,
    }),
    ...(visaIssueDate !== undefined && {
      visaIssueDate: visaIssueDate ? parseDateOnly(visaIssueDate) : null,
    }),
    ...(visaExpiry !== undefined && {
      visaExpiry: visaExpiry ? parseDateOnly(visaExpiry) : null,
    }),
    ...(arrivalInIndia !== undefined && {
      arrivalInIndia: arrivalInIndia ? parseDateOnly(arrivalInIndia) : null,
    }),
  };

  const guest = await prisma.guest.update({ where: { id }, data: { ...rest, ...parsedDates } });

  // Sync the scam list when the blacklist state (or its reason) changed.
  if (parsed.data.blocked !== undefined || parsed.data.blockReason !== undefined) {
    await syncBlacklistToScamList(guest);
  }

  return ok(guest);
}
