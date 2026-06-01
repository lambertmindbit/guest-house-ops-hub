import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

// Owner-only (behind the auth middleware): lists each room's read-only iCal
// export URL to paste into the OTA extranet's "import calendar" setting.
export default async function FeedsPage() {
  const token = process.env.ICAL_FEED_TOKEN;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3100";
  const origin = `${proto}://${host}`;

  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Calendar export feeds</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Paste a room&apos;s link into the OTA&apos;s &ldquo;import calendar / iCal sync&rdquo;
        setting so it can see when that room is booked. Links are read-only and contain a
        secret token — share them only with the OTA.
      </p>

      {!token ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          ICAL_FEED_TOKEN is not set in the environment.
        </p>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room) => {
            const url = `${origin}/api/ical/${token}/${room.id}.ics`;
            return (
              <li key={room.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="mb-1 text-sm font-medium">
                  Room {room.label} · {room.roomType.name}
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1.5 text-xs text-neutral-700">
                    {url}
                  </code>
                  <CopyButton value={url} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
