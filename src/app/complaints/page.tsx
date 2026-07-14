import Link from "next/link";
import { listComplaints, complaintReport } from "@/lib/complaints";
import { PageHead, SectionLabel, EmptyState } from "@/components/ui";
import { ComplaintForm } from "@/components/ComplaintForm";
import { displayShortDate } from "@/lib/format";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

const PRIORITY_CLS: Record<string, string> = { high: "badge--danger", medium: "badge--warn", low: "badge--neutral" };
const STATUS_CLS: Record<string, string> = { open: "badge--warn", in_progress: "badge--sent", resolved: "badge--good" };
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireModule("complaints");
  const { status } = await searchParams;
  const [rows, report] = await Promise.all([
    listComplaints({ status: status as "open" | "in_progress" | "resolved" | undefined }),
    complaintReport(),
  ]);
  const maxCat = Math.max(1, ...report.byCategory.map((c) => c.count));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Complaints" sub="Log, assign and resolve guest issues — and spot patterns." />

        {/* Report strip */}
        <div className="kpi-strip kpi-strip--3" style={{ marginTop: 14 }}>
          <div className="kpi-panel kpi-panel--verdict">
            <div className="kpi-eyebrow">Open</div>
            <div className="kpi-num">{report.openTotal}</div>
            <div className="kpi-ctx">of {report.total} total</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Avg resolution</div>
            <div className="kpi-num">{report.avgResolutionHours == null ? "—" : report.avgResolutionHours}</div>
            <div className="kpi-ctx">hours</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Top category</div>
            <div className="kpi-num" style={{ fontSize: 18 }}>{report.byCategory[0]?.category ?? "—"}</div>
            <div className="kpi-ctx">{report.byCategory[0]?.count ?? 0} logged</div>
          </div>
        </div>

        {report.byCategory.length > 0 && (
          <div className="card card--pad" style={{ marginTop: 12 }}>
            {report.byCategory.map((c) => (
              <div key={c.category} className="mixrow">
                <span className="mixrow__l">{c.category}</span>
                <span className="mixrow__track"><span className="mixrow__fill" style={{ width: `${Math.round((c.count / maxCat) * 100)}%` }} /></span>
                <span className="mixrow__v num">{c.count}</span>
              </div>
            ))}
          </div>
        )}

        <ComplaintForm />

        {/* Filters */}
        <div className="chips" style={{ margin: "16px 0 12px" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/complaints${f.key ? `?status=${f.key}` : ""}`}
              className={`chip${(status ?? "") === f.key ? " on" : ""}`}>{f.label}</Link>
          ))}
        </div>

        <SectionLabel count={rows.length}>Complaints</SectionLabel>
        {rows.length === 0 ? (
          <EmptyState>No complaints logged.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {rows.map((c) => (
              <Link key={c.id} href={`/complaints/${c.id}`} className="rowcard">
                <div className="rowcard__main">
                  <div className="rowcard__name">{c.description.length > 70 ? `${c.description.slice(0, 70)}…` : c.description}</div>
                  <div className="rowcard__meta">
                    {c.category}{c.guest ? ` · ${c.guest.name}` : ""} · {displayShortDate(c.createdAt)}
                  </div>
                </div>
                <div className="rowcard__right">
                  <span className={`badge ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  <span className={`badge ${PRIORITY_CLS[c.priority]}`}>{c.priority}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
