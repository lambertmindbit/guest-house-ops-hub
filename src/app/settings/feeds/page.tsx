import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { icalTokenForRoom } from "@/lib/ical-token";
import { CopyButton } from "@/components/CopyButton";
import { ImportFeeds } from "@/components/ImportFeeds";
import { SubHeader } from "@/components/settings/SubHeader";

export const dynamic = "force-dynamic";

export default async function FeedsPage() {
  const token = process.env.ICAL_FEED_TOKEN;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3100";
  const origin = `${proto}://${host}`;

  const [rooms, importFeeds] = await Promise.all([
    prisma.room.findMany({
      include: { roomType: true },
      orderBy: [{ roomType: { name: "asc" } }, { label: "asc" }],
    }),
    prisma.icalFeed.findMany({ include: { room: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="app-main">
      <div className="entrance">
        <SubHeader
          title="iCal feeds"
          sub="Export each room’s busy dates to OTAs, and import an OTA’s calendar so its bookings block the room here."
        />

        <div className="eyebrow eyebrow--accent" style={{ marginTop: 4 }}>Export to OTAs</div>
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", margin: "4px 0 0" }}>
          Paste a room’s link into the OTA’s “import calendar / iCal sync” setting so it can see when that room is booked.
          Links are read-only and contain a secret token — share them only with the OTA.
        </p>

        {!token ? (
          <div className="banner banner--danger" style={{ cursor: "default", marginTop: 16 }}>
            <span style={{ flex: 1 }}>ICAL_FEED_TOKEN is not set in the environment.</span>
          </div>
        ) : (
          <div className="col" style={{ gap: 12, marginTop: 16 }}>
            {rooms.map((room) => {
              const url = `${origin}/api/ical/${icalTokenForRoom(room.id)}/${room.id}.ics`;
              return (
                <div key={room.id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, marginBottom: 8 }}>
                    Room {room.label} <span style={{ color: "var(--text-subtle)", fontWeight: 500 }}>· {room.roomType.name}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", fontSize: "var(--fs-meta)", color: "var(--text-muted)", fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
                      {url}
                    </code>
                    <CopyButton value={url} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ImportFeeds
          rooms={rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name }))}
          feeds={importFeeds.map((f) => ({
            id: f.id,
            label: f.label,
            roomLabel: f.room.label,
            url: f.url,
            lastSyncedAt: f.lastSyncedAt ? f.lastSyncedAt.toISOString() : null,
            lastError: f.lastError,
          }))}
        />
      </div>
    </main>
  );
}
