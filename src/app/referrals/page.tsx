import { requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { formatDateOnly } from "@/lib/dates";
import { listPartners, listReferrals, referralSummary } from "@/lib/partners";
import { ReferralLogBoard } from "@/components/ReferralLogBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  await requireModule("referrals");
  await requireRole(["owner", "reception"]);
  const [partners, referrals] = await Promise.all([listPartners(), listReferrals()]);
  const summary = referralSummary(referrals.map((r) => ({ status: r.status })));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Referrals" sub="Log guests you send to a partner and track whether they booked." />
        <ReferralLogBoard
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          referrals={referrals.map((r) => ({
            id: r.id,
            guestName: r.guestName,
            partnerId: r.partnerId ?? null,
            partnerName: r.partner?.name ?? null,
            guestPhone: r.guestPhone,
            checkIn: r.checkIn ? formatDateOnly(r.checkIn) : null,
            checkOut: r.checkOut ? formatDateOnly(r.checkOut) : null,
            status: r.status,
            note: r.note,
          }))}
          summary={summary}
        />
      </div>
    </main>
  );
}
