import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { InboxReview } from "@/components/InboxReview";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [items, rooms, channels] = await Promise.all([
    prisma.inboundBooking.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } }),
    prisma.room.findMany({ where: { archivedAt: null }, include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({ orderBy: { name: "asc" } }),
  ]);

  const data = {
    items: items.map((i) => ({
      id: i.id,
      source: i.source,
      otaRef: i.otaRef ?? "",
      guestName: i.guestName ?? "",
      guestPhone: i.guestPhone ?? "",
      checkIn: i.checkIn ? formatDateOnly(i.checkIn) : "",
      checkOut: i.checkOut ? formatDateOnly(i.checkOut) : "",
      roomTypeHint: i.roomTypeHint ?? "",
      amount: i.amount ? Number(i.amount) : null,
      rawText: i.rawText,
    })),
    rooms: rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name })),
    channels: channels.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="shimmer">
        <PageHead title="Inbox" sub="Paste an OTA confirmation email, check the parsed details, then create the booking." />
        <InboxReview data={data} />
      </div>
    </main>
  );
}
