import { z } from "zod";
import { ok, fail, zodFail } from "@/lib/api";
import { agentTokenOk } from "@/lib/agent-auth";
import { dateOnly } from "@/lib/dates";
import { getFinanceSummary, currentMonthRange } from "@/lib/finance";
import { getAnalytics } from "@/lib/analytics";

// GET /api/agent/owner/finance?from&to
// The owner console agent's money + performance read: revenue, net profit,
// per-channel earnings, and headline performance (occupancy, ADR, RevPAR) for a
// date range. Defaults to the current month. Owner-only, behind the agent token.
// Reuses getFinanceSummary + getAnalytics (same truth as the Finance/Analytics
// screens), flattened to the numbers the agent speaks from.

const schema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export async function GET(req: Request) {
  if (!agentTokenOk(req)) return fail("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) return zodFail(parsed.error);

  const month = currentMonthRange();
  const from = parsed.data.from ?? month.from;
  const to = parsed.data.to ?? month.to;

  const [fin, an] = await Promise.all([getFinanceSummary(from, to), getAnalytics(from, to)]);

  return ok({
    from,
    to,
    revenue: {
      gross: fin.totals.gross,
      commission: fin.totals.commission,
      net: fin.totals.net,
      collected: fin.totals.collected,
      outstanding: fin.totals.outstanding,
    },
    netProfit: fin.netProfit,
    expensesTotal: fin.expensesTotal,
    bookingsArriving: an.bookingsArriving,
    occupancyPct: an.occupancyPct,
    adr: an.adr,
    revpar: an.revpar,
    avgLengthOfStay: an.avgLengthOfStay,
    byChannel: fin.byChannel.map((c) => ({
      channel: c.channel,
      bookings: c.bookings,
      gross: c.gross,
      net: c.net,
    })),
  });
}
