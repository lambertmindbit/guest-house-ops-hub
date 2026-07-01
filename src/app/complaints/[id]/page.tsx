import Link from "next/link";
import { notFound } from "next/navigation";
import { getComplaint } from "@/lib/complaints";
import { PageHead, Icon } from "@/components/ui";
import { ComplaintDetail } from "@/components/ComplaintDetail";
import { displayDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PRIORITY_CLS: Record<string, string> = { high: "badge--danger", medium: "badge--warn", low: "badge--neutral" };

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getComplaint(id);
  if (!c) notFound();

  return (
    <main className="app-main" style={{ maxWidth: 620 }}>
      <div className="entrance">
        <Link href="/complaints" className="backlink"><Icon name="chevronL" size={15} /> Complaints</Link>
        <PageHead title={c.category} sub={`Logged ${displayDate(c.createdAt)}`} />
        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <span className={`badge ${PRIORITY_CLS[c.priority]}`}>{c.priority} priority</span>
          {c.escalationId && <Link href="/needs-you" className="badge badge--warn">On “Needs you”</Link>}
          {c.guest && <Link href={`/guests/${c.guest.id}`} className="badge badge--neutral">{c.guest.name}</Link>}
          {c.reservation && <Link href={`/reservations/${c.reservation.id}`} className="badge badge--neutral">Booking</Link>}
        </div>

        <div className="card card--pad" style={{ marginTop: 14 }}>
          <div className="eyebrow">Issue</div>
          <div style={{ fontSize: "var(--fs-small)", marginTop: 6, whiteSpace: "pre-wrap" }}>{c.description}</div>
        </div>

        <ComplaintDetail
          id={c.id}
          initial={{
            status: c.status,
            assignee: c.assignee ?? "",
            resolutionNote: c.resolutionNote ?? "",
            satisfaction: c.satisfaction ?? null,
          }}
        />
      </div>
    </main>
  );
}
