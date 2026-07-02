import { getSession, requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHead } from "@/components/ui";
import { formatDateOnly } from "@/lib/dates";
import { listReferrals, creditBalances, analyticsFrom, peersAcceptingReferrals } from "@/lib/community/referrals";
import { ReferralsBoard } from "@/components/ReferralsBoard";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  await requireRole(["owner", "reception"]);
  const session = await getSession();
  const pid = session?.propertyId ?? null;

  if (!pid) {
    return (
      <main className="app-main" style={{ maxWidth: 760 }}>
        <div className="entrance">
          <PageHead title="Referrals" sub="Send overflow guests to trusted peers and track the results." />
          <div className="empty">No property is bound to your account.</div>
        </div>
      </main>
    );
  }

  const [referrals, balances, peers, recent] = await Promise.all([
    listReferrals(pid),
    creditBalances(pid),
    peersAcceptingReferrals(pid),
    prisma.reservation.findMany({
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { guest: { select: { name: true } }, room: { select: { label: true } } },
    }),
  ]);

  const outbound = referrals.filter((r) => r.direction === "outbound");
  const analytics = analyticsFrom(outbound.map((r) => ({ status: r.status, attributedRevenue: r.attributedRevenue })));
  const recentReservations = recent.map((r) => ({
    id: r.id,
    label: `${r.guest.name} · ${r.room.label} · ${formatDateOnly(r.checkIn)}`,
  }));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Referrals" sub="Send overflow guests to trusted peers and track the results." />
        <ReferralsBoard
          referrals={referrals}
          balances={balances}
          peers={peers}
          analytics={analytics}
          recentReservations={recentReservations}
        />
      </div>
    </main>
  );
}
