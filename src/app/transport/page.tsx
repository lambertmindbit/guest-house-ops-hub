import { listDrivers, listTrips, fareRollup } from "@/lib/transport";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { TransportBoard } from "@/components/TransportBoard";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const [drivers, trips, guests] = await Promise.all([
    listDrivers(), listTrips(),
    prisma.guest.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const { doneFares } = fareRollup(trips.map((t) => ({ status: t.status, fare: t.fare == null ? null : Number(t.fare) })));

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Transport" sub="Drivers and trips — history & fares." />
        <TransportBoard
          drivers={drivers.map((d) => ({ id: d.id, name: d.name, phone: d.phone, vehicleNumber: d.vehicleNumber }))}
          guests={guests.map((g) => ({ id: g.id, name: g.name }))}
          trips={trips.map((t) => ({
            id: t.id, driverId: t.driverId ?? null, driverName: t.driver?.name ?? null, guestId: t.guestId ?? null, guestName: t.guestId ? guestName.get(t.guestId) ?? null : null, pickup: t.pickup, dropoff: t.dropoff,
            scheduledAt: t.scheduledAt ? formatDateOnly(t.scheduledAt) : null, status: t.status, fare: t.fare == null ? null : Number(t.fare),
          }))}
          doneFares={doneFares}
        />
      </div>
    </main>
  );
}
