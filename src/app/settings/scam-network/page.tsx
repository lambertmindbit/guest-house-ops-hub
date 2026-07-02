import { getSession, requireRole } from "@/lib/session";
import { SubHeader } from "@/components/settings/SubHeader";
import { listMyScamReports, sharedScamListFor } from "@/lib/community/scam";
import { ScamNetworkSection } from "@/components/settings/ScamNetworkSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]);
  const session = await getSession();
  const pid = session?.propertyId ?? null;

  const [mine, shared] = pid
    ? await Promise.all([listMyScamReports(pid), sharedScamListFor(pid)])
    : [[], []];

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Community scam list" sub="Report, verify and share scam numbers with your trusted network" />
        <ScamNetworkSection mine={mine} shared={shared} />
      </div>
    </main>
  );
}
