import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, roomTypes, rooms, channels, blocks, policy, seasons] = await Promise.all([
    prisma.propertySettings.findFirst(),
    prisma.roomType.findMany({
      include: { _count: { select: { rooms: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({ include: { roomType: true }, orderBy: { label: "asc" } }),
    prisma.channel.findMany({
      include: { _count: { select: { reservations: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.block.findMany({
      where: { source: "manual" },
      include: { room: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.pricingPolicy.findFirst(),
    prisma.season.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  // Decimals/Dates aren't directly serialisable to a client component — flatten.
  const data = {
    settings: settings && {
      name: settings.name,
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      currency: settings.currency,
      timezone: settings.timezone,
      address: settings.address,
      gstNumber: settings.gstNumber,
    },
    roomTypes: roomTypes.map((t) => ({
      id: t.id,
      name: t.name,
      baseRate: Number(t.baseRate),
      maxOccupancy: t.maxOccupancy,
      rateFloor: Number(t.rateFloor),
      rateCeiling: Number(t.rateCeiling),
      roomCount: t._count.rooms,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      label: r.label,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType.name,
      archived: r.archivedAt !== null,
    })),
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      commissionPct: Number(c.commissionPct),
      collectsPayment: c.collectsPayment,
      resCount: c._count.reservations,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      roomLabel: b.room.label,
      startDate: formatDateOnly(b.startDate),
      endDate: formatDateOnly(b.endDate),
      reason: b.reason,
    })),
    policy: {
      enabled: policy?.enabled ?? true,
      weekendDays: policy?.weekendDays ?? [5, 6],
      weekendAdjustPct: Number(policy?.weekendAdjustPct ?? 0),
      leadEarlyDays: policy?.leadEarlyDays ?? null,
      leadEarlyAdjustPct: policy?.leadEarlyAdjustPct == null ? null : Number(policy.leadEarlyAdjustPct),
      leadLateDays: policy?.leadLateDays ?? null,
      leadLateAdjustPct: policy?.leadLateAdjustPct == null ? null : Number(policy.leadLateAdjustPct),
      occupancyThresholdPct: policy?.occupancyThresholdPct ?? null,
      occupancyAdjustPct: policy?.occupancyAdjustPct == null ? null : Number(policy.occupancyAdjustPct),
    },
    seasons: seasons.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: formatDateOnly(s.startDate),
      endDate: formatDateOnly(s.endDate),
      adjustPct: Number(s.adjustPct),
    })),
  };

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="shimmer">
        <PageHead title="Settings" sub="Manage your property, rooms, room types, channels, and blocks." />
        <SettingsClient data={data} />
      </div>
    </main>
  );
}
