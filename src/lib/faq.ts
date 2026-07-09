import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Owner-managed FAQ the guest assistant answers from. Tenant-scoped CRUD; the
// agent reads only ACTIVE entries via GET /api/agent/faq.

// Optional attachments the assistant can show alongside an answer.
export type FaqMedia = { photos?: string[]; mapLink?: string };

// Shared validation for the media field (lives here, not in a route file — route
// modules may only export request handlers).
export const faqMediaSchema = z
  .object({
    photos: z.array(z.string().url().max(1000)).max(8).optional(),
    mapLink: z.string().url().max(1000).optional(),
  })
  .nullable()
  .optional();

export async function listFaqs() {
  return prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function listActiveFaqs() {
  return prisma.faqEntry.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function createFaq(data: { question: string; answer: string; category?: string | null; media?: FaqMedia | null }) {
  return prisma.faqEntry.create({
    data: {
      question: data.question,
      answer: data.answer,
      category: data.category ?? null,
      media: (data.media ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateFaq(
  id: string,
  patch: { question?: string; answer?: string; category?: string | null; active?: boolean; sortOrder?: number; media?: FaqMedia | null },
) {
  const current = await prisma.faqEntry.findUnique({ where: { id } });
  if (!current) return null;
  const { media, ...rest } = patch;
  const data: Prisma.FaqEntryUpdateInput = { ...rest };
  if (media !== undefined) data.media = (media ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull;
  return prisma.faqEntry.update({ where: { id }, data });
}

export async function deleteFaq(id: string) {
  const current = await prisma.faqEntry.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.faqEntry.delete({ where: { id } });
}
