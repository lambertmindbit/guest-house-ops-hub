import { getSession, requireRole } from "@/lib/session";
import { SubHeader } from "@/components/settings/SubHeader";
import { listMyGuestAlerts, sharedGuestAlertsFor } from "@/lib/community/badguest";
import { BadGuestSection } from "@/components/settings/BadGuestSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]);
  const session = await getSession();
  const pid = session?.propertyId ?? null;

  const [mine, shared] = pid
    ? await Promise.all([listMyGuestAlerts(pid), sharedGuestAlertsFor(pid)])
    : [[], []];

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Bad-guest alerts" sub="Evidence-backed alerts, shared only with peers you choose" />
        <BadGuestSection mine={mine} shared={shared} />
      </div>
    </main>
  );
}
