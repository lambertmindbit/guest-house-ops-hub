import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReservationForm, type ReservationFormValues } from "@/components/ReservationForm";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string; date?: string }>;
}) {
  const { roomId, date } = await searchParams;
  const [rooms, channels] = await Promise.all([
    prisma.room.findMany({ include: { roomType: true }, orderBy: { label: "asc" } }),
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
    <main className="mx-auto max-w-md p-4">
      <Link href="/calendar" className="text-sm text-neutral-500 hover:underline">
        ‹ Back
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold">New reservation</h1>
      <ReservationForm
        mode="create"
        initial={initial}
        rooms={rooms.map((r) => ({ id: r.id, label: r.label, roomTypeName: r.roomType.name }))}
        channels={channels.map((c) => ({ id: c.id, name: c.name }))}
      />
    </main>
  );
}
