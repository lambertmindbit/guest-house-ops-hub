import { getSession, requireRole } from "@/lib/session";
import { SubHeader } from "@/components/settings/SubHeader";
import { listPeers, grantsFor } from "@/lib/community/network";
import { NetworkSection } from "@/components/settings/NetworkSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]);
  const session = await getSession();
  const propertyId = session?.propertyId ?? null;

  const peers = propertyId ? await listPeers(propertyId) : [];

  // Grants this property has given, keyed by peer, so each accepted peer's
  // toggles render with the right initial state.
  const accepted = peers.filter((p) => p.status === "accepted");
  const grantsByPeer: Record<string, string[]> = {};
  for (const peer of accepted) {
    const grants = propertyId ? await grantsFor(propertyId, peer.peerPropertyId) : [];
    grantsByPeer[peer.peerPropertyId] = grants.filter((g) => g.enabled).map((g) => g.dataType);
  }

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Trusted network" sub="Connect with nearby properties and choose what to share" />
        <NetworkSection connectCode={propertyId} peers={peers} grantsByPeer={grantsByPeer} />
      </div>
    </main>
  );
}
