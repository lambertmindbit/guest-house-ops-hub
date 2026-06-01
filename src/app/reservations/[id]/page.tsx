import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelBadge } from "@/components/ChannelBadge";
import { displayDate, displayMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-600",
  no_show: "bg-rose-100 text-rose-800",
};

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { guest: true, channel: true, room: { include: { roomType: true } } },
  });
  if (!r) notFound();

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/calendar" className="text-sm text-neutral-500 hover:underline">
        ‹ Back to calendar
      </Link>

      <header className="mt-2 mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{r.guest.name}</h1>
          <p className="text-sm text-neutral-500">{r.guest.phone}</p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[r.status] ?? ""}`}
        >
          {r.status}
        </span>
      </header>

      <dl className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <Row label="Room">
          {r.room.label} · {r.room.roomType.name}
        </Row>
        <Row label="Channel">
          <ChannelBadge name={r.channel.name} />
        </Row>
        <Row label="Check-in">{displayDate(r.checkIn)}</Row>
        <Row label="Check-out">{displayDate(r.checkOut)}</Row>
        {r.arrivalTime && <Row label="Arrival time">{r.arrivalTime}</Row>}
        <Row label="Amount">{displayMoney(r.grossAmount)}</Row>
        {r.otaRef && <Row label="OTA ref">{r.otaRef}</Row>}
        {r.specialRequests && <Row label="Special requests">{r.specialRequests}</Row>}
      </dl>

      <div className="mt-4">
        <Link
          href={`/reservations/${r.id}/edit`}
          className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Edit reservation
        </Link>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
