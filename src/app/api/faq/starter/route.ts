import { ok, fail, withRoute } from "@/lib/api";
import { getSession } from "@/lib/session";
import { installStarterFaqs } from "@/lib/faq";

// POST /api/faq/starter — load the comprehensive starter FAQ pack as INACTIVE
// drafts (idempotent; skips questions the property already has). Owner-only: FAQ
// content is what the guest bot speaks, so managing the pack is an owner action.
// The owner then reviews each draft and switches on the ones true for their place.
async function handlePOST() {
  const session = await getSession();
  if (session?.role !== "owner") return fail("Owners only.", 403);
  const result = await installStarterFaqs();
  return ok(result, 201);
}

export const POST = withRoute(handlePOST);
