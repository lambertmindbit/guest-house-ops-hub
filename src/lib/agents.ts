import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";

// Travel-agent commission (G3). What you owe an inbound B2B agent is derived from
// the bookings they brought — never stored — exactly like channel commission in
// finance.ts, and using the same whole-rupee rounding so the two agree to the paisa.

function num(value: { toString(): string } | null): number {
  return value === null ? 0 : Number(value);
}

// Commission owed on one booking: gross × pct, rounded to whole rupees (the app's
// money convention). Pure, so it can be unit-tested without a DB. Mirrors
// finance.ts's `Math.round((gross * commissionPct) / 100)`.
export function agentCommission(gross: number, commissionPct: number): number {
  return Math.round((gross * commissionPct) / 100);
}

export type AgentStatement = {
  agentId: string;
  name: string;
  commissionPct: number;
  bookings: number;
  gross: number;
  commission: number; // what you owe the agent
};

// Per-agent commission statement over bookings ARRIVING in [from, to) — same
// check-in attribution finance.ts uses, so a period's numbers reconcile. Only
// confirmed bookings that carry an agentId count. Agents with no bookings in the
// window are omitted (an empty statement is nothing owed).
export async function agentStatements(from: string, to: string): Promise<AgentStatement[]> {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      agentId: { not: null },
      checkIn: { gte: parseDateOnly(from), lt: parseDateOnly(to) },
    },
    select: {
      grossAmount: true,
      agent: { select: { id: true, name: true, commissionPct: true } },
    },
  });

  const byAgent = new Map<string, AgentStatement>();
  for (const r of reservations) {
    if (!r.agent) continue; // agentId set but agent filtered by tenant scope
    const gross = num(r.grossAmount);
    const pct = num(r.agent.commissionPct);
    const row = byAgent.get(r.agent.id) ?? {
      agentId: r.agent.id,
      name: r.agent.name,
      commissionPct: pct,
      bookings: 0,
      gross: 0,
      commission: 0,
    };
    row.bookings += 1;
    row.gross += gross;
    row.commission += agentCommission(gross, pct);
    byAgent.set(r.agent.id, row);
  }

  return [...byAgent.values()].sort((a, b) => b.commission - a.commission);
}
