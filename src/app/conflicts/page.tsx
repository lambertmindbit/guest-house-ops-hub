import Link from "next/link";
import { getConflicts } from "@/lib/conflicts";
import { PageHead, EmptyState, Icon } from "@/components/ui";
import { displayDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const conflicts = await getConflicts();

  return (
    <main className="app-main">
      <div className="entrance">
        <PageHead
          title="Conflicts"
          sub="Rooms that are both booked and blocked on the same nights. Resolve each by editing the reservation or removing the block it clashes with."
        />

        {conflicts.length === 0 ? (
          <div style={{ marginTop: 20 }}>
            <EmptyState>No conflicts — everything lines up.</EmptyState>
          </div>
        ) : (
          <div className="col" style={{ gap: 12, marginTop: 16 }}>
            {conflicts.map((c) => (
              <div
                key={`${c.reservationId}-${c.overlapStart}`}
                className="card card--pad"
                style={{ background: "var(--red-bg)", borderColor: "var(--red-border)" }}
              >
                <div className="row" style={{ gap: 8, color: "var(--red-text)", fontWeight: 700, fontSize: 15 }}>
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
        )}
      </div>
    </main>
  );
}
