import { getHousekeeping, type HousekeepingRoom } from "@/lib/housekeeping";
import { CleaningButton } from "@/components/CleaningButton";
import { PageHead, SectionLabel, EmptyState } from "@/components/ui";
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
      <div className="entrance">
        <PageHead
          title="Housekeeping"
          sub={toCleanCount === 0 ? "All rooms are clean." : `${toCleanCount} room${toCleanCount === 1 ? "" : "s"} to clean.`}
        />

        <SectionLabel count={toClean.length}>To clean</SectionLabel>
        {toClean.length === 0 ? (
          <EmptyState>Nothing to clean — every room is ready.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {toClean.map((room) => (
              <div
                key={room.id}
                className="card card--pad"
                style={room.highPriority ? { background: "var(--red-bg)", borderColor: "var(--red-border)" } : undefined}
              >
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RoomTitle room={room} />
                    <div style={{ margin: "8px 0" }}><Tags room={room} /></div>
                    {room.lastDeparture && (
                      <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>
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

        <SectionLabel count={ready.length}>Ready</SectionLabel>
        {ready.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--fs-small)" }}>No rooms are ready right now.</p>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {ready.map((room) => (
              <div key={room.id} className="card card--pad">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
    <div className="h3" style={{ fontSize: "var(--fs-h3)" }}>
      Room {room.label} <span className="muted" style={{ fontWeight: 500 }}>· {room.roomTypeName}</span>
    </div>
  );
}

// Red is reserved for genuine urgency (arriving today). Occupied-tonight is a
// neutral badge so the red still means "act now".
function Tags({ room }: { room: HousekeepingRoom }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {room.highPriority && <span className="badge badge--danger">Arriving today — clean first</span>}
      {!room.highPriority && room.arrivalToday && <span className="badge badge--warn">Arrival today</span>}
      {room.occupiedTonight && <span className="badge badge--neutral">Occupied tonight</span>}
    </div>
  );
}
