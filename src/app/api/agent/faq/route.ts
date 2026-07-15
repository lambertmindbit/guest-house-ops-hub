import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { listActiveFaqs } from "@/lib/faq";
import { withTenant } from "@/lib/tenant";
import { agentTokenOk } from "@/lib/agent-auth";

// GET /api/agent/faq — the ACTIVE owner-managed FAQ the guest assistant answers
// from (parking, wifi, check-in time, house rules…). Read-only, token-gated.

const schema = z.object({ propertyRef: z.string().optional() });

async function handleGET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ propertyRef: searchParams.get("propertyRef") ?? undefined });
  if (!parsed.success) return zodFail(parsed.error);

  // Each property has its own FAQ. Scope to the one the agent is asking about, so a
  // shared agent answers with the right property's parking/wifi/house rules — not a
  // mix of every property's. Absent → sole-property fallback.
  const propertyRef = parsed.data.propertyRef;
  const faqs = await (propertyRef ? withTenant(propertyRef, listActiveFaqs) : listActiveFaqs());
  return ok(faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category, media: f.media ?? null })));
}

export const GET = withRoute(handleGET);
