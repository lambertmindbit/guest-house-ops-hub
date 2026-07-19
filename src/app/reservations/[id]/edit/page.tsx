import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReservationForm, type ReservationFormValues } from "@/components/ReservationForm";
import { CancelReservationButton } from "@/components/CancelReservationButton";
import { PageHead, Icon } from "@/components/ui";
import { formatDateOnly } from "@/lib/dates";
import { paiseToRupees } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [reservation, rooms, channels, agents] = await Promise.all([
    prisma.reservation.findUnique({ where: { id }, include: { guest: true } }),
    prisma.room.findMany({ include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({ orderBy: { name: "asc" } }),
    prisma.agent.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!reservation) notFound();

  const initial: ReservationFormValues = {
    id: reservation.id,
    version: reservation.version,
    roomId: reservation.roomId,
    channelId: reservation.channelId,
    agentId: reservation.agentId ?? "",
    checkIn: formatDateOnly(reservation.checkIn),
    checkOut: formatDateOnly(reservation.checkOut),
    arrivalTime: reservation.arrivalTime ?? "",
    specialRequests: reservation.specialRequests ?? "",
    // Stored as paise (GAP-9); the form fields hold rupees.
    grossAmount: reservation.grossAmount ? String(paiseToRupees(Number(reservation.grossAmount))) : "",
    advanceRequired: reservation.advanceRequired ? String(paiseToRupees(Number(reservation.advanceRequired))) : "",
    guestName: reservation.guest.name,
    guestPhone: reservation.guest.phone,
  };

  return (
    <main className="app-main" style={{ maxWidth: 620 }}>
      <div className="entrance">
        <Link href={`/reservations/${id}`} className="btn btn--ghost btn--sm" style={{ paddingLeft: 6, marginBottom: 8 }}>
          <Icon name="chevronL" size={16} /> Back
        </Link>
        <PageHead title="Edit booking" sub={reservation.guest.name} />
        <ReservationForm
          mode="edit"
          initial={initial}
          rooms={rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name }))}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
        />
        {reservation.status === "confirmed" && (
          <div style={{ marginTop: 12 }}>
            <CancelReservationButton id={id} />
          </div>
        )}
      </div>
    </main>
  );
}
