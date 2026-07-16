import { prisma } from "@/lib/prisma";
import { SubHeader } from "@/components/settings/SubHeader";
import { AgentsSection } from "@/components/settings/sections";
import { agentStatements } from "@/lib/agents";
import { todayDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

// [first-of-this-month, first-of-next-month) in the property's local date.
function monthBounds(today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${y}-${pad(m)}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { from, to };
}

export default async function Page() {
  const { from, to } = monthBounds(todayDateOnly());
  const [agents, statements] = await Promise.all([
    prisma.agent.findMany({
      include: { _count: { select: { reservations: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    agentStatements(from, to),
  ]);
  const owedByAgent = new Map(statements.map((s) => [s.agentId, s.commission]));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Travel agents" sub="Verified B2B agents, their commission rate, and what you owe this month" />
        <AgentsSection
          agents={agents.map((a) => ({
            id: a.id,
            name: a.name,
            phone: a.phone,
            commissionPct: Number(a.commissionPct),
            verified: a.verifiedAt !== null,
            active: a.active,
            notes: a.notes,
            resCount: a._count.reservations,
            commissionThisMonth: owedByAgent.get(a.id) ?? 0,
          }))}
        />
      </div>
    </main>
  );
}
