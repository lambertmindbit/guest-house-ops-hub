import Link from "next/link";
import { getConflicts } from "@/lib/conflicts";
import { displayDate } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ConflictsPage() {
  const conflicts = await getConflicts();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Conflicts</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Rooms that are both booked and blocked on the same nights. Resolve each by editing the
        reservation (move/cancel) or removing the block it clashes with.
      </p>

      {conflicts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-400">
          No conflicts — everything lines up. 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {conflicts.map((c) => (
            <li
              key={`${c.reservationId}-${c.overlapStart}`}
              className="rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <div className="text-sm font-semibold text-red-800">
                Room {c.roomLabel} · overlap {displayDate(parseDateOnly(c.overlapStart))} →{" "}
                {displayDate(parseDateOnly(c.overlapEnd))}
              </div>
              <div className="mt-1 text-sm text-neutral-700">
                Booking: <span className="font-medium">{c.guestName}</span> (
                {displayDate(parseDateOnly(c.reservationStart))} →{" "}
                {displayDate(parseDateOnly(c.reservationEnd))})
              </div>
              <div className="text-sm text-neutral-700">
                Block: {c.blockReason ?? "—"}{" "}
                <span className="text-neutral-400">({c.blockSource})</span>
              </div>
              <Link
                href={`/reservations/${c.reservationId}`}
                className="mt-2 inline-block text-sm font-medium text-red-700 hover:underline"
              >
                Open reservation →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
