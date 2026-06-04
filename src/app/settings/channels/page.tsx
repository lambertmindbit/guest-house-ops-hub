import { prisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { ChannelsSection } from "@/components/settings/sections";

export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await prisma.channel.findMany({
    include: { _count: { select: { reservations: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Channels" sub="Booking sources & commission" />
        <ChannelsSection
          channels={channels.map((c) => ({
            id: c.id,
            name: c.name,
            commissionPct: Number(c.commissionPct),
            collectsPayment: c.collectsPayment,
            resCount: c._count.reservations,
          }))}
        />
      </div>
    </main>
  );
}
