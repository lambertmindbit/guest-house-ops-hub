import Link from "next/link";
import { getConflicts } from "@/lib/conflicts";
import { listEscalations } from "@/lib/escalations";
import { PageHead, EmptyState, Icon } from "@/components/ui";
import { displayDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

// "Needs you" — the merged human-in-the-loop queue: booking conflicts (a room
// both booked and blocked) + agent escalations awaiting a decision. Both are
// "only you can decide this." Triage of an escalation still happens on the full
// /escalations queue (kept as a deep link); this is the at-a-glance merge that
// the Today banner and the nav "Needs you" badge point at.

const SEV_KIND: Record<string, string> = {
  critical: "danger",
  high: "danger",
  medium: "warn",
  low: "neutral",
};
const SOURCE_LABEL: Record<string, string> = {
  assistant: "the assistant",
  cab: "the cab agent",
  console: "the front desk",
  system: "the system",
};

export default async function NeedsYouPage() {
  const [conflicts, escalations] = await Promise.all([
    getConflicts(),
    listEscalations({}),
  ]);
  const approvals = escalations.filter((e) => e.status === "open" || e.status === "in_progress");

  return (
    <main className="app-main">
      <div className="entrance">
        <Link href="/" className="backlink"><Icon name="chevronL" size={15} /> Today</Link>
        <PageHead
          title="Needs you"
          sub="Decisions only you can make — booking conflicts and approvals the assistant filed."
        />

        {conflicts.length === 0 && approvals.length === 0 ? (
          <div style={{ marginTop: 20 }}>
            <EmptyState>Nothing needs you right now — conflicts and approvals are clear.</EmptyState>
          </div>
        ) : null}

        {/* ---- Booking conflicts ---- */}
        {conflicts.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 8 }}>
              <div className="section-label__l">
                <span className="section-label__t">Booking conflicts</span>
                <span className="section-label__c">{conflicts.length}</span>
              </div>
            </div>
            <div className="col" style={{ gap: 12 }}>
              {conflicts.map((c) => (
                <div
                  key={`${c.reservationId}-${c.overlapStart}`}
                  className="card card--pad"
                  style={{ background: "var(--red-bg)", borderColor: "var(--red-border)" }}
                >
                  <div className="row" style={{ gap: 8, color: "var(--red-text)", fontWeight: 700, fontSize: "var(--fs-h3)" }}>
                    <Icon name="alert" size={18} /> Room {c.roomLabel} · overlap{" "}
                    {displayDate(parseDateOnly(c.overlapStart))} – {displayDate(parseDateOnly(c.overlapEnd))}
                  </div>
                  <div style={{ fontSize: "var(--fs-small)", marginTop: 10, lineHeight: 1.7 }}>
                    <div>
                      <span className="muted">Booking:</span>{" "}
                      <b style={{ fontWeight: 600, color: "var(--ink)" }}>{c.guestName}</b>{" "}
                      ({displayDate(parseDateOnly(c.reservationStart))} – {displayDate(parseDateOnly(c.reservationEnd))})
                    </div>
                    <div>
                      <span className="muted">Block:</span>{" "}
                      <b style={{ fontWeight: 600, color: "var(--ink)" }}>{c.blockReason ?? "—"}</b>{" "}
                      <span className="muted">({c.blockSource})</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 12 }}>
                    <Link href={`/reservations/${c.reservationId}`} className="btn btn--primary btn--sm">
                      Open reservation <Icon name="arrowR" size={15} />
                    </Link>
                    {c.blockSource === "manual" && (
                      <Link href="/settings/blocks" className="btn btn--ghost btn--sm">Remove block</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---- Approvals (escalations) ---- */}
        {approvals.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 20 }}>
              <div className="section-label__l">
                <span className="section-label__t">Approvals</span>
                <span className="section-label__c">{approvals.length}</span>
              </div>
              <Link href="/escalations" className="section-label__a">All <Icon name="arrowR" size={13} /></Link>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {approvals.map((e) => {
                const toReservation = e.relatedType === "reservation" && e.relatedId
                  ? `/reservations/${e.relatedId}`
                  : null;
                return (
                  <div key={e.id} className="card card--pad">
                    <div className="spread" style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "var(--fs-small)" }}>{e.title}</span>
                      <span className={`badge badge--${SEV_KIND[e.severity] ?? "neutral"}`}>{e.severity}</span>
                    </div>
                    <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", marginBottom: 4 }}>
                      From {SOURCE_LABEL[e.source] ?? e.source}
                    </div>
                    <div style={{ fontSize: "var(--fs-small)", color: "var(--text)" }}>{e.summary}</div>
                    <div className="row" style={{ gap: 8, marginTop: 12 }}>
                      <Link href="/escalations" className="btn btn--primary btn--sm">Review &amp; approve</Link>
                      {toReservation && (
                        <Link href={toReservation} className="btn btn--ghost btn--sm">Open reservation</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
