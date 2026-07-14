import { listTours, listTourPartners, listTourBookings, commissionSummary } from "@/lib/tours";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { ToursBoard } from "@/components/ToursBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  await requireModule("tours");
  const [tours, partners, bookings, guests] = await Promise.all([
    listTours(), listTourPartners(), listTourBookings(),
    prisma.guest.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const guestName = new Map(guests.map((g) => [g.id, g.name]));
  const summary = commissionSummary(
    bookings.map((b) => ({ amount: b.amount ? Number(b.amount) : null, commissionPct: b.commissionPct, status: b.status })),
  );

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Tours" sub="Activities, partners/guides and guest tour bookings." />
        <ToursBoard
          tours={tours.map((t) => ({ id: t.id, name: t.name, price: t.price ? Number(t.price) : null, partnerId: t.partnerId, partnerName: t.partner?.name ?? null, active: t.active }))}
          partners={partners.map((p) => ({ id: p.id, name: p.name, contact: p.contact, commissionPct: p.commissionPct }))}
          guests={guests.map((g) => ({ id: g.id, name: g.name }))}
          bookings={bookings.map((b) => ({ id: b.id, tourName: b.tour.name, partnerName: b.partner?.name ?? null, guestId: b.guestId ?? null, guestName: b.guestId ? guestName.get(b.guestId) ?? null : null, date: b.date ? formatDateOnly(b.date) : null, amount: b.amount ? Number(b.amount) : null, status: b.status }))}
          summary={summary}
        />
      </div>
    </main>
  );
}
