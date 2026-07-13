import { z } from "zod";
import { ok, zodFail, withRoute } from "@/lib/api";
import { importCsv } from "@/lib/import";

// Owner-only (cookie-gated). Runs the guided CSV import; dryRun previews without
// writing. Booking rows go through the guarded create path (409 on overlap).
const schema = z.object({
  type: z.enum(["guests", "bookings", "faqs"]),
  csv: z.string().min(1),
  dryRun: z.boolean().optional(),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const result = await importCsv(parsed.data.type, parsed.data.csv, { dryRun: parsed.data.dryRun });
  return ok(result);
}

export const POST = withRoute(handlePOST);
