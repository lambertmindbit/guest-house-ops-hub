import { SubHeader } from "@/components/settings/SubHeader";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { currentPropertySettings } from "@/lib/property-settings";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await currentPropertySettings().catch(() => null);
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Notifications" sub="Owner push alerts for the things that can't wait in a queue" />
        <NotificationsSection
          initial={{
            pushEscalations: s?.pushEscalations ?? true,
            pushConflicts: s?.pushConflicts ?? true,
            pushStaleSync: s?.pushStaleSync ?? true,
          }}
        />
      </div>
    </main>
  );
}
