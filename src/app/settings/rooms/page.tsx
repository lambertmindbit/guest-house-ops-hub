import { prisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { RoomsSection } from "@/components/settings/sections";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [rooms, types] = await Promise.all([
    prisma.room.findMany({ include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.roomType.findMany({ include: { _count: { select: { rooms: true } } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Rooms" sub="Add, archive or remove rooms" />
        <RoomsSection
          rooms={rooms.map((r) => ({
            id: r.id,
            label: r.label,
            roomTypeId: r.roomTypeId,
            roomTypeName: r.roomType.name,
            archived: r.archivedAt !== null,
            photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
            facing: r.facing,
            view: r.view,
          }))}
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
