import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroup, ungroupedReservations, folioTotal } from "@/lib/groups";
import { PageHead, Icon } from "@/components/ui";
import { GroupDetail } from "@/components/GroupDetail";
import { displayShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [group, ungrouped] = await Promise.all([getGroup(id), ungroupedReservations()]);
  if (!group) notFound();

  const children = group.reservations.map((r) => {
    const collected = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      id: r.id,
      guestName: r.guest.name,
      roomLabel: r.room.label,
      dates: `${displayShortDate(r.checkIn)} → ${displayShortDate(r.checkOut)}`,
      gross: r.grossAmount == null ? null : Number(r.grossAmount),
      collected,
    };
  });
  const folio = folioTotal(children.map((c) => ({ gross: c.gross, collected: c.collected })));

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <Link href="/groups" className="backlink"><Icon name="chevronL" size={15} /> Booking groups</Link>
        <PageHead title={group.name} sub="One folio across several room bookings." />
        <GroupDetail
          groupId={group.id}
          bookings={children}
          folio={folio}
          ungrouped={ungrouped.map((r) => ({ id: r.id, label: `${r.guest.name} · Room ${r.room.label} · ${displayShortDate(r.checkIn)}` }))}
        />
      </div>
    </main>
  );
}
