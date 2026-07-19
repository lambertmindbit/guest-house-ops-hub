import Link from "next/link";
import { getFinanceSummary, getPayoutReconciliation, currentMonthRange } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { displayINR } from "@/lib/format";
import { PageHead, SectionLabel, RangeForm, ChannelBadge, Icon } from "@/components/ui";
import { ExpensesPanel } from "@/components/ExpensesPanel";
import { PayoutsPanel } from "@/components/PayoutsPanel";

export const dynamic = "force-dynamic";

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const month = currentMonthRange();
  const from = isDate(params.from) ? params.from : month.from;
  const to = isDate(params.to) ? params.to : month.to;
  const [summary, recon, otaChannels] = await Promise.all([
    getFinanceSummary(from, to),
    getPayoutReconciliation(),
    prisma.channel.findMany({ where: { collectsPayment: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const t = summary.totals;

  return (
    <main className="app-main">
      <div className="entrance">
        <PageHead title="Finance" sub={`Bookings arriving ${from} – ${to} · ${t.bookings} booking${t.bookings === 1 ? "" : "s"}`} />
        <RangeForm from={from} to={to} />

        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <a href={`/api/export/reservations.csv?from=${from}&to=${to}`} className="btn btn--ghost btn--sm" download>
            <Icon name="arrowDown" size={15} /> Bookings CSV
          </a>
          <a href={`/api/export/payments.csv?from=${from}&to=${to}`} className="btn btn--ghost btn--sm" download>
            <Icon name="arrowDown" size={15} /> Payments CSV
          </a>
        </div>

        {/* Net-to-you verdict first. */}
        <div className="kpi-strip" style={{ marginTop: 14 }}>
          <div className="kpi-panel kpi-panel--verdict">
            <div className="kpi-eyebrow">Net to you</div>
            <div className="kpi-num">{displayINR(summary.netProfit)}</div>
            <div className="kpi-ctx">after commission &amp; expenses</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Gross revenue</div>
            <div className="kpi-num">{displayINR(t.gross)}</div>
            <div className="kpi-ctx">net to you {displayINR(t.net)}</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Commission</div>
            <div className="kpi-num">{displayINR(t.commission)}</div>
            <div className="kpi-ctx">to channels · expenses {displayINR(summary.expensesTotal)}</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Outstanding</div>
            <div className="kpi-num" style={{ color: "var(--amber-text)" }}>{displayINR(t.outstanding)}</div>
            <div className="kpi-ctx">balances due</div>
          </div>
        </div>

        <SectionLabel>By channel</SectionLabel>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="r">Bookings</th>
                <th className="r">Gross</th>
                <th className="r">Commission</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {summary.byChannel.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-subtle)" }}>No bookings in this period.</td></tr>
              ) : (
                summary.byChannel.map((c) => (
                  <tr key={c.channel}>
                    <td><ChannelBadge name={c.channel} /></td>
                    <td className="r num">{c.bookings}</td>
                    <td className="r num">{displayINR(c.gross)}</td>
                    <td className="r num" style={{ color: c.commission ? "var(--amber-text)" : "var(--text-subtle)" }}>{displayINR(c.commission)}</td>
                    <td className="r num strong">{displayINR(c.net)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ExpensesPanel expenses={summary.expenses} total={summary.expensesTotal} />

        <PayoutsPanel recon={recon} channels={otaChannels} />

        {summary.outstanding.length > 0 && (
          <>
            <SectionLabel>Balances due</SectionLabel>
            <div className="col" style={{ gap: 10 }}>
              {summary.outstanding.map((o) => (
                <Link
                  key={o.reservationId}
                  href={`/reservations/${o.reservationId}`}
                  className="banner banner--warn"
                >
                  <span className="banner__txt">
                    <b>{o.guestName}</b> · Room {o.roomLabel}
                  </span>
                  <span className="num" style={{ fontWeight: 700 }}>{displayINR(o.balance)} due</span>
                  <span className="banner__arrow"><Icon name="chevronR" size={16} /></span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
