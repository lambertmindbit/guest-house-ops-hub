import { prisma } from "@/lib/prisma";
import { parseDateOnly, todayDateOnly } from "@/lib/dates";

function num(value: { toString(): string } | null): number {
  return value === null ? 0 : Number(value);
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
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "confirmed",
      checkIn: { gte: parseDateOnly(from), lt: parseDateOnly(to) },
    },
    include: { channel: true, guest: true, room: true, payments: true },
    orderBy: { checkIn: "asc" },
  });

  const byChannelMap = new Map<string, ChannelTotals>();
  const totals = { bookings: 0, gross: 0, commission: 0, net: 0, collected: 0, outstanding: 0 };
  const outstanding: FinanceSummary["outstanding"] = [];

  for (const r of reservations) {
    const gross = num(r.grossAmount);
    const commission = Math.round((gross * num(r.channel.commissionPct)) / 100);
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

  return {
    from,
    to,
    totals,
    byChannel: [...byChannelMap.values()].sort((a, b) => b.gross - a.gross),
    outstanding,
  };
}
