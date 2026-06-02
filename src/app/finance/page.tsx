import Link from "next/link";
import { getFinanceSummary, currentMonthRange } from "@/lib/finance";
import { displayINR } from "@/lib/format";
import { PageHead, SectionLabel, KPI, RangeForm, ChannelBadge, Icon } from "@/components/ui";
import { ExpensesPanel } from "@/components/ExpensesPanel";

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
  const summary = await getFinanceSummary(from, to);
  const t = summary.totals;

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead title="Finance" sub={`Bookings arriving ${from} – ${to} · ${t.bookings} booking${t.bookings === 1 ? "" : "s"}`} />
        <RangeForm from={from} to={to} />

        <div className="kpi-grid" style={{ marginTop: 14 }}>
          <KPI value={displayINR(t.gross)} label="Gross revenue" icon="wallet" />
          <KPI value={displayINR(t.commission)} label="OTA commission" icon="link" />
          <KPI value={displayINR(summary.expensesTotal)} label="Expenses" tone="warn" icon="tag" />
          <KPI value={displayINR(summary.netProfit)} label="Net profit" tone="good" icon="checkCircle" />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--subtle)", margin: "10px 2px 0", lineHeight: 1.5 }}>
          Net to you after commission <b className="num" style={{ color: "var(--ink)" }}>{displayINR(t.net)}</b>
          {" · "}less expenses <b className="num" style={{ color: "var(--ink)" }}>{displayINR(summary.expensesTotal)}</b>
          {" · "}outstanding balances <b className="num" style={{ color: "var(--ink)" }}>{displayINR(t.outstanding)}</b>
        </p>

        <SectionLabel>By channel</SectionLabel>
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="ralign">Bookings</th>
                  <th className="ralign">Gross</th>
                  <th className="ralign">Commission</th>
                  <th className="ralign">Net</th>
                </tr>
              </thead>
              <tbody>
                {summary.byChannel.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--subtle)" }}>No bookings in this period.</td></tr>
                ) : (
                  summary.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td><ChannelBadge name={c.channel} /></td>
                      <td className="ralign num">{c.bookings}</td>
                      <td className="ralign num">{displayINR(c.gross)}</td>
                      <td className="ralign num" style={{ color: c.commission ? "var(--clay-700)" : "var(--subtle)" }}>{displayINR(c.commission)}</td>
                      <td className="ralign num" style={{ fontWeight: 700 }}>{displayINR(c.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ExpensesPanel expenses={summary.expenses} total={summary.expensesTotal} />

        {summary.outstanding.length > 0 && (
          <>
            <SectionLabel>Balances due</SectionLabel>
            <div className="col" style={{ gap: 12 }}>
              {summary.outstanding.map((o) => (
                <Link
                  key={o.reservationId}
                  href={`/reservations/${o.reservationId}`}
                  className="card"
                  style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--warn-50)", borderColor: "rgba(224,152,47,.3)" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{o.guestName}</div>
                    <div style={{ fontSize: 12.5, color: "var(--subtle)" }}>Room {o.roomLabel}</div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="num" style={{ fontWeight: 700, color: "var(--warn-700)" }}>{displayINR(o.balance)} due</span>
                    <Icon name="chevronR" size={16} style={{ color: "var(--warn-700)" }} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
