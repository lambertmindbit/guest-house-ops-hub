import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { httpUrl } from "@/lib/url-guard";
import { STARTER_FAQS } from "@/lib/faq-starter";

// Owner-managed FAQ the guest assistant answers from. Tenant-scoped CRUD; the
// agent reads only ACTIVE entries via GET /api/agent/faq.

// Optional attachments the assistant can show alongside an answer.
export type FaqMedia = { photos?: string[]; mapLink?: string };

// Shared validation for the media field (lives here, not in a route file — route
// modules may only export request handlers).
export const faqMediaSchema = z
  .object({
    // http(s) only — mapLink is rendered as a clickable anchor in guest chat, so
    // a javascript: URL here would be stored XSS.
    photos: z.array(httpUrl()).max(8).optional(),
    mapLink: httpUrl().optional(),
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

// Install the starter FAQ pack as INACTIVE drafts. Idempotent: any question the
// property already has (case-insensitively) is skipped, so it's safe to run more
// than once and never clobbers an owner's edited answer. Loaded inactive so the
// bot won't speak a draft to a guest until the owner reviews and switches it on.
export async function installStarterFaqs(): Promise<{ added: number; skipped: number }> {
  const existing = await prisma.faqEntry.findMany({ select: { question: true } });
  const have = new Set(existing.map((f) => f.question.trim().toLowerCase()));

  const toAdd = STARTER_FAQS.filter((f) => !have.has(f.question.trim().toLowerCase()));
  let sortOrder = 100; // starter drafts sort after any hand-authored FAQs
  for (const f of toAdd) {
    await prisma.faqEntry.create({
      data: { question: f.question, answer: f.answer, category: f.category, active: false, sortOrder: sortOrder++ },
    });
  }
  return { added: toAdd.length, skipped: STARTER_FAQS.length - toAdd.length };
}
