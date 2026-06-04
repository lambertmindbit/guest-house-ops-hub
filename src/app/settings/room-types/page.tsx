import { prisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { RoomTypesSection } from "@/components/settings/sections";

export const dynamic = "force-dynamic";

export default async function Page() {
  const types = await prisma.roomType.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Room types" sub="Categories, rates and occupancy" />
        <RoomTypesSection
          types={types.map((t) => ({
            id: t.id,
            name: t.name,
            baseRate: Number(t.baseRate),
            maxOccupancy: t.maxOccupancy,
            rateFloor: Number(t.rateFloor),
            rateCeiling: Number(t.rateCeiling),
            roomCount: t._count.rooms,
          }))}
        />
      </div>
    </main>
  );
}
