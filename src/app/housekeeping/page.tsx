import { getHousekeeping, type HousekeepingRoom } from "@/lib/housekeeping";
import { CleaningButton } from "@/components/CleaningButton";
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
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Housekeeping</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {toCleanCount === 0
          ? "All rooms are clean."
          : `${toCleanCount} room${toCleanCount === 1 ? "" : "s"} to clean.`}
      </p>

      {toClean.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">To clean</h2>
          <ul className="space-y-2">
            {toClean.map((room) => (
              <RoomRow key={room.id} room={room} action="clean" />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">
          Ready <span className="text-neutral-400">({ready.length})</span>
        </h2>
        {ready.length === 0 ? (
          <p className="text-sm text-neutral-400">No rooms are ready right now.</p>
        ) : (
          <ul className="space-y-2">
            {ready.map((room) => (
              <RoomRow key={room.id} room={room} action="dirty" />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function RoomRow({ room, action }: { room: HousekeepingRoom; action: "clean" | "dirty" }) {
  const dirty = action === "clean";
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
        room.highPriority ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <div className="font-medium">
          Room {room.label} <span className="text-neutral-400">· {room.roomTypeName}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-xs">
          {room.highPriority && (
            <span className="rounded bg-red-600 px-1.5 py-0.5 font-medium text-white">
              Arriving today — clean first
            </span>
          )}
          {!room.highPriority && room.arrivalToday && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Arrival today</span>
          )}
          {room.occupiedTonight && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">Occupied tonight</span>
          )}
          {dirty && room.lastDeparture && (
            <span className="text-neutral-400">
              Checked out {displayShortDate(parseDateOnly(room.lastDeparture))}
            </span>
          )}
        </div>
      </div>
      <CleaningButton roomId={room.id} markCleaned={dirty} />
    </li>
  );
}
