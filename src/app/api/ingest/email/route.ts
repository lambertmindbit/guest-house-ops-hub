import { z } from "zod";
import { ok, fail, zodFail, withRoute } from "@/lib/api";
import { ingestEmail } from "@/lib/inbound";

// Token-gated webhook entry point for AUTOMATED ingestion. This is the seam the
// inbox plumbing plugs into later: point an email-forwarding rule / Email Worker
// at this URL with the INGEST_TOKEN. It is excluded from the owner-cookie
// middleware (see src/middleware.ts) and gated by its own shared secret.
//
// Until the inbox exists, nothing calls this — the owner pastes via /api/inbound.
const schema = z.object({ raw: z.string().min(1) });

async function handlePOST(request: Request) {
  const secret = process.env.INGEST_TOKEN;
  const provided = request.headers.get("x-ingest-token") ?? new URL(request.url).searchParams.get("token");
  if (!secret || provided !== secret) {
    return fail("unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const inbound = await ingestEmail(parsed.data.raw);
  return ok({ id: inbound.id, status: inbound.status }, 201);
}

export const POST = withRoute(handlePOST);
