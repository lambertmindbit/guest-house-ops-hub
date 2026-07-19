import { prisma } from "@/lib/prisma";
import { parseDateOnly, todayDateOnly } from "@/lib/dates";
import { requestPropertyId } from "@/lib/tenant";
import { pctOfMoneyWholeRupee, type Money } from "@/lib/money";

// Read a money column (BIGINT paise) as Money; NULL → 0 paise.
function num(value: bigint | number | null): Money {
  return (value === null ? 0 : Number(value)) as Money;
}

// Commission on a gross amount at a channel's percentage (Q-FIN-01: all % on
// gross). Single definition so the "net to you" in the channel table and the
// "owed by the OTA" in payout reconciliation can never diverge. Commission stays
// whole-rupee (the app's convention) — see pctOfMoneyWholeRupee.
export function commissionOn(gross: number, commissionPct: number): Money {
  return pctOfMoneyWholeRupee(gross, commissionPct);
}

export type ChannelTotals = {
  channel: string;
  bookings: number;
  gross: number;
  commission: number;
  net: number;
  collected: number;
  outstanding: number;
};

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string | null;
  paymentMode: string | null;
};

export type FinanceSummary = {
  from: string;
  to: string;
  totals: Omit<ChannelTotals, "channel">;
  byChannel: ChannelTotals[];
  outstanding: {
    reservationId: string;
    guestName: string;
    roomLabel: string;
    gross: number;
    collected: number;
    balance: number;
  }[];
  expenses: ExpenseRow[];
  expensesTotal: number;
  // True bottom line: net to you (gross − commission) minus running costs.
  netProfit: number;
};

// First/last day of the current month, as YYYY-MM-DD.
export function currentMonthRange(): { from: string; to: string } {
  const today = parseDateOnly(todayDateOnly());
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const next = new Date(Date.UTC(y, m + 1, 1));
  return { from: first.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) };
}

// Revenue is attributed by check-in date: bookings ARRIVING in [from, to).
// Commission per booking = gross x channel.commission_pct; net = gross - commission.
// Collected = sum of payments; outstanding = gross - collected.
export async function getFinanceSummary(from: string, to: string): Promise<FinanceSummary> {
  const [reservations, expenseRows] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: "confirmed",
        checkIn: { gte: parseDateOnly(from), lt: parseDateOnly(to) },
      },
      // Only the fields the aggregation below reads — not whole related rows.
      select: {
        id: true,
        grossAmount: true,
        channel: { select: { name: true, commissionPct: true } },
        guest: { select: { name: true } },
        room: { select: { label: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: parseDateOnly(from), lt: parseDateOnly(to) } },
      orderBy: { date: "desc" },
    }),
  ]);

  const byChannelMap = new Map<string, ChannelTotals>();
  const totals = { bookings: 0, gross: 0, commission: 0, net: 0, collected: 0, outstanding: 0 };
  const outstanding: FinanceSummary["outstanding"] = [];

  for (const r of reservations) {
    const gross = num(r.grossAmount);
    const commission = commissionOn(gross, Number(r.channel.commissionPct));
    const net = gross - commission;
    const collected = r.payments.reduce((s, p) => s + num(p.amount), 0);
    const balance = gross - collected;

    totals.bookings += 1;
    totals.gross += gross;
    totals.commission += commission;
    totals.net += net;
    totals.collected += collected;
    totals.outstanding += balance;

    const row = byChannelMap.get(r.channel.name) ?? {
      channel: r.channel.name,
      bookings: 0,
      gross: 0,
      commission: 0,
      net: 0,
      collected: 0,
      outstanding: 0,
    };
    row.bookings += 1;
    row.gross += gross;
    row.commission += commission;
    row.net += net;
    row.collected += collected;
    row.outstanding += balance;
    byChannelMap.set(r.channel.name, row);

    if (balance > 0) {
      outstanding.push({
        reservationId: r.id,
        guestName: r.guest.name,
        roomLabel: r.room.label,
        gross,
        collected,
        balance,
      });
    }
  }

  const expenses: ExpenseRow[] = expenseRows.map((e) => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    category: e.category,
    amount: num(e.amount),
    note: e.note,
    paymentMode: e.paymentMode,
  }));
  const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    from,
    to,
    totals,
    byChannel: [...byChannelMap.values()].sort((a, b) => b.gross - a.gross),
    outstanding,
    expenses,
    expensesTotal,
    netProfit: totals.net - expensesTotal,
  };
}

// ── Pending payments (all-time outstanding across confirmed bookings) ────────
export type PendingPayments = { total: number; count: number };

// Pure: sum positive balances over confirmed bookings. Derived, never stored.
export function sumOutstanding(
  rows: { grossAmount: number; collected: number; status: string }[],
): PendingPayments {
  let total = 0;
  let count = 0;
  for (const r of rows) {
    if (r.status !== "confirmed") continue;
    const balance = r.grossAmount - r.collected;
    if (balance > 0) {
      total += balance;
      count += 1;
    }
  }
  return { total, count };
}

// ── OTA payout reconciliation (GAP-13/US-405) ───────────────────────────────
// For channels the OTA collects payment on, the OTA owes the property gross −
// commission per confirmed booking. Recording the settlements it actually sends
// lets the owner see, per OTA, whether they've been paid in full.

export type PayoutRow = { id: string; amount: number; paidAt: string; reference: string | null; note: string | null };

export type ChannelRecon = {
  channelId: string;
  channel: string;
  bookings: number; // confirmed OTA-collect bookings (all-time)
  owed: number; // Σ net (gross − commission) the OTA owes
  received: number; // Σ recorded payouts
  variance: number; // owed − received; > 0 = still owed to you, < 0 = overpaid/mismatch
  payouts: PayoutRow[];
};

// Pure aggregation so the arithmetic is unit-testable without a DB. Cumulative /
// all-time and per OTA-collect channel — this answers "has the OTA paid what it
// owes", so it deliberately ignores any date range (owed accrues by booking, cash
// arrives later; a period-scoped variance would be dominated by that timing).
export function reconcilePayouts(
  channels: { id: string; name: string }[],
  bookings: { channelId: string; owed: number }[],
  payouts: (PayoutRow & { channelId: string })[],
): ChannelRecon[] {
  const rows = new Map<string, ChannelRecon>();
  for (const c of channels) {
    rows.set(c.id, { channelId: c.id, channel: c.name, bookings: 0, owed: 0, received: 0, variance: 0, payouts: [] });
  }
  for (const b of bookings) {
    const row = rows.get(b.channelId);
    if (!row) continue; // booking on a non-collect channel — not reconciled here
    row.bookings += 1;
    row.owed += b.owed;
  }
  for (const p of payouts) {
    const row = rows.get(p.channelId);
    if (!row) continue;
    row.received += p.amount;
    row.payouts.push({ id: p.id, amount: p.amount, paidAt: p.paidAt, reference: p.reference, note: p.note });
  }
  const out: ChannelRecon[] = [];
  for (const row of rows.values()) {
    if (row.bookings === 0 && row.payouts.length === 0) continue; // configured-but-unused OTA
    row.variance = row.owed - row.received;
    out.push(row);
  }
  return out.sort((a, b) => b.owed - a.owed);
}

export async function getPayoutReconciliation(): Promise<ChannelRecon[]> {
  const [channels, reservations, payouts] = await Promise.all([
    prisma.channel.findMany({ where: { collectsPayment: true }, select: { id: true, name: true } }),
    prisma.reservation.findMany({
      where: { status: "confirmed", channel: { collectsPayment: true } },
      select: { channelId: true, grossAmount: true, channel: { select: { commissionPct: true } } },
    }),
    prisma.payout.findMany({
      orderBy: { paidAt: "desc" },
      select: { id: true, channelId: true, amount: true, paidAt: true, reference: true, note: true },
    }),
  ]);

  const bookings = reservations.map((r) => {
    const gross = num(r.grossAmount);
    return { channelId: r.channelId, owed: gross - commissionOn(gross, Number(r.channel.commissionPct)) };
  });
  const payoutRows = payouts.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    amount: num(p.amount),
    paidAt: p.paidAt.toISOString().slice(0, 10),
    reference: p.reference,
    note: p.note,
  }));

  return reconcilePayouts(channels, bookings, payoutRows);
}

export async function getPendingPayments(): Promise<PendingPayments> {
  // All-time (no date bound), so this is the one finance query that grows without
  // limit — and it runs on every Today dashboard load. Aggregate in the DB instead
  // of streaming every confirmed reservation + its payments into Node. Mirrors
  // sumOutstanding exactly (positive balances only; NULL gross treated as 0). Raw
  // SQL bypasses the tenant extension, so scope by the acting property ourselves;
  // dashboard-pending.test.ts pins both the total AND multi-tenant isolation.
  const pid = await requestPropertyId();
  const rows = await prisma.$queryRaw<{ total: number; count: number }[]>`
    SELECT
      COALESCE(SUM(balance) FILTER (WHERE balance > 0), 0)::float8 AS total,
      COUNT(*) FILTER (WHERE balance > 0)::int AS count
    FROM (
      SELECT COALESCE(r.gross_amount, 0) - COALESCE(SUM(p.amount), 0) AS balance
        FROM reservations r
        LEFT JOIN payments p ON p.reservation_id = r.id
       WHERE r.status = 'confirmed'
         AND (${pid}::text IS NULL OR r.property_id = ${pid})
       GROUP BY r.id, r.gross_amount
    ) balances;
  `;
  return { total: Number(rows[0]?.total ?? 0), count: Number(rows[0]?.count ?? 0) };
}
