import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/dates";
import { SubHeader } from "@/components/settings/SubHeader";
import { PricingSection } from "@/components/settings/sections";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [policy, seasons] = await Promise.all([
    prisma.pricingPolicy.findFirst(),
    prisma.season.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Pricing rules" sub="Weekend, season, lead-time and occupancy" />
        <PricingSection
          policy={{
            enabled: policy?.enabled ?? true,
            weekendDays: policy?.weekendDays ?? [5, 6],
            weekendAdjustPct: Number(policy?.weekendAdjustPct ?? 0),
            leadEarlyDays: policy?.leadEarlyDays ?? null,
            leadEarlyAdjustPct: policy?.leadEarlyAdjustPct == null ? null : Number(policy.leadEarlyAdjustPct),
            leadLateDays: policy?.leadLateDays ?? null,
            leadLateAdjustPct: policy?.leadLateAdjustPct == null ? null : Number(policy.leadLateAdjustPct),
            occupancyThresholdPct: policy?.occupancyThresholdPct ?? null,
            occupancyAdjustPct: policy?.occupancyAdjustPct == null ? null : Number(policy.occupancyAdjustPct),
          }}
          seasons={seasons.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: formatDateOnly(s.startDate),
            endDate: formatDateOnly(s.endDate),
            adjustPct: Number(s.adjustPct),
          }))}
        />
      </div>
    </main>
  );
}
