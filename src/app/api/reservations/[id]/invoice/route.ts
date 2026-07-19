import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { issueInvoice, cancelAndReissue } from "@/lib/invoices";
import { recordAudit } from "@/lib/audit";

// Issue a statutory invoice for a booking (GAP-11/US-205). Issuing is deliberate —
// it consumes a number in the financial-year series — so it's a POST, never a
// side-effect of viewing. `reissue` cancels the live invoice and issues a fresh one.
const schema = z.object({ reissue: z.boolean().optional() });

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return zodFail(parsed.error);

  const result = parsed.data.reissue ? await cancelAndReissue(id) : await issueInvoice(id);
  if (!result.ok) return fail(result.error, 422);

  await recordAudit(
    parsed.data.reissue ? "invoice.reissue" : "invoice.issue",
    "invoice",
    result.invoiceId,
    `Invoice ${result.number}`,
  ).catch(() => {});

  return ok({ invoiceId: result.invoiceId, number: result.number }, 201);
}

export const POST = withRoute(handlePOST);
