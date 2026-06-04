import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { SubHeader } from "@/components/settings/SubHeader";
import { BlocksSection } from "@/components/settings/sections";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [blocks, rooms] = await Promise.all([
    prisma.block.findMany({ where: { source: "manual" }, include: { room: true }, orderBy: { startDate: "asc" } }),
    prisma.room.findMany({ where: { archivedAt: null }, include: { roomType: true }, orderBy: { label: "asc" } }),
  ]);

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Blocked dates" sub="Hold rooms out of service" />
        <BlocksSection
          blocks={blocks.map((b) => ({
            id: b.id,
            roomId: b.roomId,
            roomLabel: b.room.label,
            startDate: formatDateOnly(b.startDate),
            endDate: formatDateOnly(b.endDate),
            reason: b.reason,
          }))}
          rooms={rooms.map((r) => ({
            id: r.id,
            label: r.label,
            roomTypeId: r.roomTypeId,
            roomTypeName: r.roomType.name,
            archived: false,
          }))}
        />
      </div>
    </main>
  );
}
