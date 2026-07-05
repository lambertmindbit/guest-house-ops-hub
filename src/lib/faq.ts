import { prisma } from "@/lib/prisma";

// Owner-managed FAQ the guest assistant answers from. Tenant-scoped CRUD; the
// agent reads only ACTIVE entries via GET /api/agent/faq.

export async function listFaqs() {
  return prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function listActiveFaqs() {
  return prisma.faqEntry.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function createFaq(data: { question: string; answer: string; category?: string | null }) {
  return prisma.faqEntry.create({ data: { question: data.question, answer: data.answer, category: data.category ?? null } });
}

export async function updateFaq(id: string, patch: { question?: string; answer?: string; category?: string | null; active?: boolean; sortOrder?: number }) {
  const current = await prisma.faqEntry.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.faqEntry.update({ where: { id }, data: patch });
}

export async function deleteFaq(id: string) {
  const current = await prisma.faqEntry.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.faqEntry.delete({ where: { id } });
}
