import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReservationForm, type ReservationFormValues } from "@/components/ReservationForm";
import { CancelReservationButton } from "@/components/CancelReservationButton";
import { formatDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [reservation, rooms, channels] = await Promise.all([
    prisma.reservation.findUnique({ where: { id }, include: { guest: true } }),
    prisma.room.findMany({ include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!reservation) notFound();

  const initial: ReservationFormValues = {
    id: reservation.id,
    roomId: reservation.roomId,
    channelId: reservation.channelId,
    checkIn: formatDateOnly(reservation.checkIn),
    checkOut: formatDateOnly(reservation.checkOut),
    arrivalTime: reservation.arrivalTime ?? "",
    specialRequests: reservation.specialRequests ?? "",
    grossAmount: reservation.grossAmount ? String(reservation.grossAmount) : "",
    guestName: reservation.guest.name,
    guestPhone: reservation.guest.phone,
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href={`/reservations/${id}`} className="text-sm text-neutral-500 hover:underline">
        ‹ Back
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold">Edit reservation</h1>
      <ReservationForm
        mode="edit"
        initial={initial}
        rooms={rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name }))}
        channels={channels.map((c) => ({ id: c.id, name: c.name }))}
      />
      {reservation.status === "confirmed" && (
        <div className="mt-3">
          <CancelReservationButton id={id} />
        </div>
      )}
    </main>
  );
}
