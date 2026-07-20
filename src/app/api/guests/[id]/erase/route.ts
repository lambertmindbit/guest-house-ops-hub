import { ok, fail, withRoute } from "@/lib/api";
import { eraseGuest } from "@/lib/dpdp";
import { recordAudit } from "@/lib/audit";

// DPDP right to erasure (GAP-8/US-202). Irreversible: PII is anonymised in place.
// The guest row, their bookings and their invoices survive so financial and
// statutory records stay intact — see src/lib/dpdp.ts for the full policy.
async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await eraseGuest(id);
  if (!result) return fail("guest not found", 404);

  // Audited without re-recording the personal data that was just erased.
  await recordAudit(
    "guest.erase",
    "guest",
    id,
    `Erased personal data on request. Withheld: tax invoices (statutory retention), audit events (integrity).`,
  ).catch(() => {});

  return ok(result);
}

export const POST = withRoute(handlePOST);
