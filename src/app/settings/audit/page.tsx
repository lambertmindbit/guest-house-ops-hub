import { listAudit, describeAudit } from "@/lib/audit";
import { SubHeader } from "@/components/settings/SubHeader";
import { EmptyState } from "@/components/ui";
import { displayDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const events = await listAudit();

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Audit log" sub="Sensitive actions — cancellations, refunds, blacklist, user & consent changes" />
        {events.length === 0 ? (
          <EmptyState>No audit events yet.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {events.map((e) => (
              <div key={e.id} className="rowcard">
                <div className="rowcard__main">
                  <div className="rowcard__name">{describeAudit({ action: e.action, entityType: e.entityType, summary: e.summary })}</div>
                  <div className="rowcard__meta">{e.action} · {displayDate(new Date(e.createdAt))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
