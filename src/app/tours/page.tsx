import { listTours, listTourPartners, listTourBookings, commissionSummary } from "@/lib/tours";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { ToursBoard } from "@/components/ToursBoard";

export const dynamic = "force-dynamic";

export default async function ToursPage() {
  const [tours, partners, bookings] = await Promise.all([listTours(), listTourPartners(), listTourBookings()]);
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
          bookings={bookings.map((b) => ({ id: b.id, tourName: b.tour.name, partnerName: b.partner?.name ?? null, date: b.date ? formatDateOnly(b.date) : null, amount: b.amount ? Number(b.amount) : null, status: b.status }))}
          summary={summary}
        />
      </div>
    </main>
  );
}
