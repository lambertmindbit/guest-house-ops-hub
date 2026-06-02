import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReservationForm, type ReservationFormValues } from "@/components/ReservationForm";
import { PageHead, Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; date?: string }>;
}) {
  const { roomId, date } = await searchParams;
  const [rooms, channels] = await Promise.all([
    prisma.room.findMany({ where: { archivedAt: null }, include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({ orderBy: { name: "asc" } }),
  ]);

  const initial: ReservationFormValues = {
    roomId: roomId ?? "",
    channelId: "",
    checkIn: date ?? "",
    checkOut: "",
    arrivalTime: "",
    specialRequests: "",
    grossAmount: "",
    guestName: "",
    guestPhone: "",
  };

  return (
    <main className="app-main" style={{ maxWidth: 620 }}>
      <div className="shimmer">
        <Link href="/" className="btn btn--ghost btn--sm" style={{ paddingLeft: 6, marginBottom: 8 }}>
          <Icon name="chevronL" size={16} /> Back
        </Link>
        <PageHead title="New booking" sub="Add a reservation to the calendar" />
        <ReservationForm
          mode="create"
          initial={initial}
          rooms={rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name }))}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </main>
  );
}
