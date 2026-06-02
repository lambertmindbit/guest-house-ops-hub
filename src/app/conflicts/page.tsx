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
      <div className="shimmer">
        <PageHead
          title="Conflicts"
          sub="Rooms that are both booked and blocked on the same nights. Resolve each by editing the reservation or removing the block it clashes with."
        />

        {conflicts.length === 0 ? (
          <div style={{ marginTop: 20 }}>
            <EmptyState>No conflicts — everything lines up. ✦</EmptyState>
          </div>
        ) : (
          <div className="col" style={{ gap: 12, marginTop: 16 }}>
            {conflicts.map((c) => (
              <div
                key={`${c.reservationId}-${c.overlapStart}`}
                className="card"
                style={{ padding: 16, background: "var(--danger-50)", borderColor: "rgba(229,72,77,.3)" }}
              >
                <div className="row" style={{ gap: 8, color: "var(--danger-700)", fontWeight: 700, fontSize: 15.5 }}>
                  <Icon name="alert" size={18} /> Room {c.roomLabel} · overlap{" "}
                  {displayDate(parseDateOnly(c.overlapStart))} → {displayDate(parseDateOnly(c.overlapEnd))}
                </div>
                <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
                  <div>
                    <span style={{ color: "var(--subtle)" }}>Booking:</span>{" "}
                    <b style={{ fontWeight: 600 }}>{c.guestName}</b> (
                    {displayDate(parseDateOnly(c.reservationStart))} → {displayDate(parseDateOnly(c.reservationEnd))})
                  </div>
                  <div>
                    <span style={{ color: "var(--subtle)" }}>Block:</span>{" "}
                    <b style={{ fontWeight: 600 }}>{c.blockReason ?? "—"}</b>{" "}
                    <span style={{ color: "var(--subtle)" }}>({c.blockSource})</span>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Link href={`/reservations/${c.reservationId}`} className="btn btn--dark btn--sm">
                    Open reservation <Icon name="arrowR" size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
