import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { dateOnly, parseDateOnly } from "@/lib/dates";
import { syncBlacklistToScamList } from "@/lib/blacklist-sync";
import { recordAudit } from "@/lib/audit";

const optDate = dateOnly.nullable().optional();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().nullable().optional(),
    idNumber: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    blocked: z.boolean().optional(),
    blockReason: z.string().nullable().optional(),
    // Privacy consent to store the guest's details.
    consentGiven: z.boolean().optional(),
    // Guest-record completion
    address: z.string().trim().nullable().optional(),
    vehicleNumber: z.string().trim().nullable().optional(),
    emergencyContactName: z.string().trim().nullable().optional(),
    emergencyContactPhone: z.string().trim().nullable().optional(),
    preferences: z.array(z.string().trim().min(1)).optional(),
    idChecked: z.boolean().optional(),
    idPhotocopied: z.boolean().optional(),
    idUploaded: z.boolean().optional(),
    idVerificationCompleted: z.boolean().optional(),
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

async function handlePATCH(
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
    consentGiven,
    ...rest
  } = parsed.data;

  // Translate the consent toggle into a timestamp + channel.
  const consent =
    consentGiven === undefined
      ? {}
      : consentGiven
        ? { consentGivenAt: new Date(), consentChannel: "in-person" }
        : { consentGivenAt: null, consentChannel: null };

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

  const guest = await prisma.guest.update({ where: { id }, data: { ...rest, ...parsedDates, ...consent } });

  // Sync the scam list when the blacklist state (or its reason) changed.
  if (parsed.data.blocked !== undefined || parsed.data.blockReason !== undefined) {
    await syncBlacklistToScamList(guest);
  }
  if (parsed.data.blocked !== undefined && parsed.data.blocked !== existing.blocked) {
    await recordAudit(guest.blocked ? "guest.blacklist" : "guest.unblacklist", "guest", id, guest.name).catch(() => {});
  }

  return ok(guest);
}

export const PATCH = withRoute(handlePATCH);
