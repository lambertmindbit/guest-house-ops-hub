import { z } from "zod";
import { ok, zodFail } from "@/lib/api";
import { listFaqs, createFaq, faqMediaSchema } from "@/lib/faq";

export async function GET() {
  return ok(await listFaqs());
}

const schema = z.object({
  question: z.string().trim().min(1, "question is required"),
  answer: z.string().trim().min(1, "answer is required"),
  category: z.string().trim().min(1).nullable().optional(),
  media: faqMediaSchema,
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  return ok(await createFaq(parsed.data), 201);
}
