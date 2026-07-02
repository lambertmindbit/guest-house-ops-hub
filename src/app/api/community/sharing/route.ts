import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { grantsFor, setGrant, SHARE_TYPES } from "@/lib/community/network";
import { recordAudit } from "@/lib/audit";

// Per-peer, per-data-type sharing toggles. Owner-only. Grantor is always the
// acting property from the session.

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.propertyId) return fail("No property is bound to your account.", 400);
  const peer = new URL(request.url).searchParams.get("peer");
  if (!peer) return fail("peer is required.", 400);
  return ok(await grantsFor(session.propertyId, peer));
}

const schema = z.object({
  peerPropertyId: z.string().min(1),
  dataType: z.enum(SHARE_TYPES as [string, ...string[]]),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "owner") return fail("Owners only.", 403);
  const propertyId = session.propertyId;
  if (!propertyId) return fail("No property is bound to your account.", 400);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodFail(parsed.error);
  const { peerPropertyId, dataType, enabled } = parsed.data;

  const result = await setGrant(propertyId, peerPropertyId, dataType as (typeof SHARE_TYPES)[number], enabled);
  if (!result.ok) return fail(result.error, 409);

  await recordAudit(
    enabled ? "community.share.enable" : "community.share.disable",
    "sharing_grant",
    `${peerPropertyId}:${dataType}`,
    `${enabled ? "Shared" : "Stopped sharing"} ${dataType} with a peer`,
  ).catch(() => {});
  return ok({ ok: true });
}
