import { getHousekeeping, type HousekeepingRoom } from "@/lib/housekeeping";
import { CleaningButton } from "@/components/CleaningButton";
import { PageHead, SectionLabel, StatusPill, EmptyState } from "@/components/ui";
import { displayShortDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  const { rooms, toCleanCount } = await getHousekeeping();
  const toClean = rooms
    .filter((r) => r.needsCleaning)
    .sort((a, b) => Number(b.highPriority) - Number(a.highPriority));
  const ready = rooms.filter((r) => !r.needsCleaning);

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead
          title="Housekeeping"
          sub={toCleanCount === 0 ? "All rooms are clean ✦" : `${toCleanCount} room${toCleanCount === 1 ? "" : "s"} to clean.`}
        />

        <SectionLabel>To clean</SectionLabel>
        {toClean.length === 0 ? (
          <EmptyState>Nothing to clean — every room is ready.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {toClean.map((room) => (
              <div
                key={room.id}
                className="card"
                style={{
                  padding: 17,
                  borderColor: room.highPriority ? "rgba(229,72,77,.35)" : "var(--line)",
                  background: room.highPriority ? "var(--danger-50)" : "var(--paper)",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <RoomTitle room={room} />
                    <div style={{ margin: "8px 0" }}><Tags room={room} /></div>
                    {room.lastDeparture && (
                      <div style={{ fontSize: 12.5, color: "var(--subtle)" }}>
                        Checked out {displayShortDate(parseDateOnly(room.lastDeparture))}
                      </div>
                    )}
                  </div>
                  <CleaningButton roomId={room.id} markCleaned />
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionLabel count={`(${ready.length})`}>Ready</SectionLabel>
        {ready.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--subtle)" }}>No rooms are ready right now.</p>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {ready.map((room) => (
              <div key={room.id} className="card" style={{ padding: 17 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <RoomTitle room={room} />
                    <div style={{ marginTop: 8 }}><Tags room={room} /></div>
                  </div>
                  <CleaningButton roomId={room.id} markCleaned={false} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function RoomTitle({ room }: { room: HousekeepingRoom }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 16 }}>
      Room {room.label} <span style={{ color: "var(--subtle)", fontWeight: 500 }}>· {room.roomTypeName}</span>
    </div>
  );
}

function Tags({ room }: { room: HousekeepingRoom }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {room.highPriority && <StatusPill kind="danger">Arriving today — clean first</StatusPill>}
      {!room.highPriority && room.arrivalToday && <StatusPill kind="warn">Arrival today</StatusPill>}
      {room.occupiedTonight && <StatusPill kind="teal">Occupied tonight</StatusPill>}
    </div>
  );
}
