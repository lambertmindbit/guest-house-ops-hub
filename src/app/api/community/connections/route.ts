import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { invitePeer, listPeers } from "@/lib/community/network";
import { recordAudit } from "@/lib/audit";

// Trusted-network connections. Owner-only (also gated in middleware). The acting
// property comes from the session — never from the request body.

export async function GET() {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);
  return ok(await listPeers(session.propertyId));
}

const inviteSchema = z.object({ connectCode: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "owner") return fail("Owners only.", 403);
  const propertyId = session.propertyId;
  if (!propertyId) return fail("No property is bound to your account.", 400);

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);

  const result = await invitePeer(propertyId, parsed.data.connectCode);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit("community.invite", "network_connection", result.connectionId, "Invited a peer property").catch(() => {});
  return ok({ id: result.connectionId }, 201);
}
