import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { listActiveFaqs } from "@/lib/faq";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/faq — the ACTIVE owner-managed FAQ the guest assistant answers
// from (parking, wifi, check-in time, house rules…). Read-only, token-gated.

const schema = z.object({ propertyRef: z.string().optional() });

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ propertyRef: searchParams.get("propertyRef") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);

  const faqs = await listActiveFaqs();
  return ok(faqs.map((f) => ({ question: f.question, answer: f.answer, category: f.category })));
}
