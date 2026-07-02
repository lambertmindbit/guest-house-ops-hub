import { listDrivers, listTrips, fareRollup } from "@/lib/transport";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { TransportBoard } from "@/components/TransportBoard";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const [drivers, trips] = await Promise.all([listDrivers(), listTrips()]);
  const { doneFares } = fareRollup(trips.map((t) => ({ status: t.status, fare: t.fare == null ? null : Number(t.fare) })));

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Transport" sub="Drivers and trips — history & fares." />
        <TransportBoard
          drivers={drivers.map((d) => ({ id: d.id, name: d.name, phone: d.phone, vehicleNumber: d.vehicleNumber }))}
          trips={trips.map((t) => ({
            id: t.id, driverName: t.driver?.name ?? null, pickup: t.pickup, dropoff: t.dropoff,
            scheduledAt: t.scheduledAt ? formatDateOnly(t.scheduledAt) : null, status: t.status, fare: t.fare == null ? null : Number(t.fare),
          }))}
          doneFares={doneFares}
        />
      </div>
    </main>
  );
}
