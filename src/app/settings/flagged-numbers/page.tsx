import { prisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { FlaggedNumbersSection } from "@/components/settings/FlaggedNumbersSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const numbers = await prisma.flaggedNumber.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader
          title="Scam / flagged numbers"
          sub="Phone numbers to warn about at booking time"
        />
        <FlaggedNumbersSection
          numbers={numbers.map((n) => ({
            id: n.id,
            phone: n.phone,
            reason: n.reason,
            createdAt: n.createdAt.toISOString().slice(0, 10),
          }))}
        />
      </div>
    </main>
  );
}
