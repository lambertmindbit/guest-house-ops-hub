import { prisma } from "@/lib/prisma";
import { listAmenities, listRoomTypeAmenities, amenityIdsByRoomType } from "@/lib/amenities";
import { SubHeader } from "@/components/settings/SubHeader";
import { AmenitiesSection } from "@/components/settings/AmenitiesSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [amenities, roomTypes, links] = await Promise.all([
    listAmenities(),
    prisma.roomType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listRoomTypeAmenities(),
  ]);

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Amenities" sub="What the property offers, and per room type" />
        <AmenitiesSection
          amenities={amenities.map((a) => ({ id: a.id, name: a.name }))}
          roomTypes={roomTypes}
          byRoomType={amenityIdsByRoomType(links)}
        />
      </div>
    </main>
  );
}
