import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { InboxReview } from "@/components/InboxReview";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  await requireModule("inbox");
  const [items, rooms, channels] = await Promise.all([
    prisma.inboundBooking.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } }),
    prisma.room.findMany({ where: { archivedAt: null }, include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({ orderBy: { name: "asc" } }),
  ]);

  // For modification/cancellation items, load the booking they matched so the UI
  // can show a Current → New diff (GAP-2).
  const linkedIds = [...new Set(items.map((i) => i.reservationId).filter((v): v is string => !!v))];
  const linked = linkedIds.length
    ? await prisma.reservation.findMany({ where: { id: { in: linkedIds } }, include: { guest: true } })
    : [];
  const linkedById = new Map(linked.map((r) => [r.id, r]));

  const data = {
    items: items.map((i) => {
      const cur = i.reservationId ? linkedById.get(i.reservationId) : undefined;
      return {
        id: i.id,
        source: i.source,
        emailKind: i.emailKind,
        otaRef: i.otaRef ?? "",
        guestName: i.guestName ?? "",
        guestPhone: i.guestPhone ?? "",
        checkIn: i.checkIn ? formatDateOnly(i.checkIn) : "",
        checkOut: i.checkOut ? formatDateOnly(i.checkOut) : "",
        roomTypeHint: i.roomTypeHint ?? "",
        amount: i.amount ? Number(i.amount) : null,
        rawText: i.rawText,
        linked: cur
          ? { guestName: cur.guest.name, checkIn: formatDateOnly(cur.checkIn), checkOut: formatDateOnly(cur.checkOut), amount: cur.grossAmount ? Number(cur.grossAmount) : null, status: cur.status }
          : null,
      };
    }),
    rooms: rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name })),
    channels: channels.map((c) => ({ id: c.id, name: c.name })),
  };

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <PageHead title="Inbox" sub="Paste an OTA confirmation email, check the parsed details, then create the booking." />
        <InboxReview data={data} />
      </div>
    </main>
  );
}
