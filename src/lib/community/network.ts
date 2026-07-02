import { prisma } from "@/lib/prisma";
import type { ConnectionStatus, ShareType } from "@prisma/client";

// The trusted-network foundation: property-to-property connections + per-peer,
// per-data-type sharing grants. This module (and the rest of src/lib/community/*)
// is the ONLY place allowed to reason across tenants. The NetworkConnection and
// SharingGrant tables are not tenant-scoped (they reference two properties), so
// every query here filters by property id EXPLICITLY — there is no auto-scope to
// lean on. Default-deny: peer data is readable only via canRead below.

export const SHARE_TYPES: ShareType[] = [
  "availability", "referrals", "scam", "bad_guest", "vendors", "transport",
];

export const SHARE_LABELS: Record<ShareType, string> = {
  availability: "Available rooms",
  referrals: "Overflow referrals",
  scam: "Scam / flagged numbers",
  bad_guest: "Bad-guest alerts",
  vendors: "Trusted vendors",
  transport: "Drivers & transport",
};

export type GrantRow = {
  grantorPropertyId: string;
  granteePropertyId: string;
  dataType: ShareType;
  enabled: boolean;
};

// ─── The single cross-tenant guard (pure, unit-tested) ──────────────────────
// May `viewerPropertyId` read `ownerPropertyId`'s data of `type`? Requires BOTH
// an accepted connection between the two AND an enabled grant from owner→viewer
// for that exact type. Every cross-tenant read in later slices funnels through
// this. Direction matters: a grant is one-way (owner shares with viewer).
export function canRead(input: {
  connectionStatus: ConnectionStatus | null;
  grants: GrantRow[];
  ownerPropertyId: string;
  viewerPropertyId: string;
  type: ShareType;
}): boolean {
  if (input.connectionStatus !== "accepted") return false;
  return input.grants.some(
    (g) =>
      g.enabled &&
      g.dataType === input.type &&
      g.grantorPropertyId === input.ownerPropertyId &&
      g.granteePropertyId === input.viewerPropertyId,
  );
}

// ─── Connections ────────────────────────────────────────────────────────────

// The connection between two properties in EITHER direction (the pair is unique
// per direction, but a trust edge is logically symmetric, so check both).
export async function connectionBetween(a: string, b: string) {
  return prisma.networkConnection.findFirst({
    where: {
      OR: [
        { requesterPropertyId: a, addresseePropertyId: b },
        { requesterPropertyId: b, addresseePropertyId: a },
      ],
    },
  });
}

export type PeerConnection = {
  connectionId: string;
  status: ConnectionStatus;
  direction: "outgoing" | "incoming";
  peerPropertyId: string;
  peerName: string;
  peerLocality: string | null;
};

// All of a property's connections, joined with the peer's public profile.
export async function listPeers(propertyId: string): Promise<PeerConnection[]> {
  const connections = await prisma.networkConnection.findMany({
    where: {
      OR: [{ requesterPropertyId: propertyId }, { addresseePropertyId: propertyId }],
      status: { not: "revoked" },
    },
    orderBy: { createdAt: "desc" },
  });

  const peerIds = connections.map((c) =>
    c.requesterPropertyId === propertyId ? c.addresseePropertyId : c.requesterPropertyId,
  );
  const profiles = await prisma.propertySettings.findMany({
    where: { id: { in: peerIds } },
    select: { id: true, name: true, publicName: true, locality: true },
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return connections.map((c) => {
    const outgoing = c.requesterPropertyId === propertyId;
    const peerId = outgoing ? c.addresseePropertyId : c.requesterPropertyId;
    const profile = byId.get(peerId);
    return {
      connectionId: c.id,
      status: c.status,
      direction: outgoing ? "outgoing" : "incoming",
      peerPropertyId: peerId,
      peerName: profile?.publicName || profile?.name || "Unknown property",
      peerLocality: profile?.locality ?? null,
    };
  });
}

// A friendly result the routes turn into { data } / { error }.
type Result<T = object> = { ok: true } & T | { ok: false; error: string };

// Invite a peer (by their connect code = property id). Rejects self-invites and
// duplicates.
export async function invitePeer(
  fromPropertyId: string,
  connectCode: string,
): Promise<Result<{ connectionId: string }>> {
  const peerId = connectCode.trim();
  if (!peerId || peerId === fromPropertyId) {
    return { ok: false, error: "Enter a valid connect code for another property." };
  }
  const peer = await prisma.propertySettings.findUnique({ where: { id: peerId }, select: { id: true } });
  if (!peer) return { ok: false, error: "No property found for that connect code." };

  const existing = await connectionBetween(fromPropertyId, peerId);
  if (existing && existing.status !== "declined") {
    return { ok: false, error: "You already have a connection or pending invite with that property." };
  }

  const connection = await prisma.networkConnection.create({
    data: { requesterPropertyId: fromPropertyId, addresseePropertyId: peerId, status: "pending" },
  });
  return { ok: true, connectionId: connection.id };
}

// Accept/decline an incoming invite (addressee only) or revoke (either party).
export async function respondToInvite(
  connectionId: string,
  propertyId: string,
  action: "accept" | "decline" | "revoke",
): Promise<Result> {
  const connection = await prisma.networkConnection.findUnique({ where: { id: connectionId } });
  if (!connection) return { ok: false, error: "Connection not found." };

  const isAddressee = connection.addresseePropertyId === propertyId;
  const isParty = isAddressee || connection.requesterPropertyId === propertyId;
  if (!isParty) return { ok: false, error: "That connection is not yours." };

  if (action === "revoke") {
    await prisma.networkConnection.update({ where: { id: connectionId }, data: { status: "revoked" } });
    return { ok: true };
  }
  // accept/decline is the addressee's call, only while pending.
  if (!isAddressee || connection.status !== "pending") {
    return { ok: false, error: "This invite can no longer be answered." };
  }
  await prisma.networkConnection.update({
    where: { id: connectionId },
    data: { status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() },
  });
  return { ok: true };
}

// ─── Sharing grants ─────────────────────────────────────────────────────────

// Grants a property has GIVEN to a specific peer (owner→peer).
export async function grantsFor(grantorPropertyId: string, granteePropertyId: string): Promise<GrantRow[]> {
  return prisma.sharingGrant.findMany({
    where: { grantorPropertyId, granteePropertyId },
    select: { grantorPropertyId: true, granteePropertyId: true, dataType: true, enabled: true },
  });
}

// Toggle one data-type share from grantor→grantee. Requires an accepted
// connection first (you can't share with someone you haven't connected to).
export async function setGrant(
  grantorPropertyId: string,
  granteePropertyId: string,
  dataType: ShareType,
  enabled: boolean,
): Promise<Result> {
  const connection = await connectionBetween(grantorPropertyId, granteePropertyId);
  if (connection?.status !== "accepted") {
    return { ok: false, error: "Connect with this property before sharing data." };
  }
  await prisma.sharingGrant.upsert({
    where: {
      grantorPropertyId_granteePropertyId_dataType: { grantorPropertyId, granteePropertyId, dataType },
    },
    create: { grantorPropertyId, granteePropertyId, dataType, enabled },
    update: { enabled },
  });
  return { ok: true };
}

// Fetch the connection + grants and apply the guard. The reliable entry point
// later slices call before reading a peer's tenant-scoped data (they also
// audit-log the read). Throws if not permitted.
export async function assertCanRead(ownerPropertyId: string, viewerPropertyId: string, type: ShareType) {
  const connection = await connectionBetween(ownerPropertyId, viewerPropertyId);
  const grants = await grantsFor(ownerPropertyId, viewerPropertyId);
  const allowed = canRead({
    connectionStatus: connection?.status ?? null,
    grants,
    ownerPropertyId,
    viewerPropertyId,
    type,
  });
  if (!allowed) {
    throw new Error(`Not permitted: ${viewerPropertyId} cannot read ${type} of ${ownerPropertyId}`);
  }
}
