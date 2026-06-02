import { getAnalytics } from "@/lib/analytics";
import { currentMonthRange } from "@/lib/finance";
import { displayINR } from "@/lib/format";
import { PageHead, SectionLabel, KPI, RangeForm, ChannelBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pct = (n: number) => `${Math.round(n)}%`;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const month = currentMonthRange();
  const from = isDate(params.from) ? params.from : month.from;
  const to = isDate(params.to) ? params.to : month.to;
  const a = await getAnalytics(from, to);

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead title="Analytics" sub={`${from} – ${to} · ${a.nights} night${a.nights === 1 ? "" : "s"}, ${a.rooms} rooms`} />
        <RangeForm from={from} to={to} />

        <div className="kpi-grid" style={{ marginTop: 14 }}>
          <KPI value={pct(a.occupancyPct)} label="Occupancy" sub={`${a.soldRoomNights}/${a.availableRoomNights} room-nights`} tone="teal" icon="bed" />
          <KPI value={displayINR(a.adr)} label="ADR" sub="avg nightly rate" icon="wallet" />
          <KPI value={displayINR(a.revpar)} label="RevPAR" sub="rev / available room" icon="chart" />
          <KPI value={`${a.avgLengthOfStay.toFixed(1)} nts`} label="Avg stay" icon="moon" />
        </div>
        <div style={{ marginTop: 12 }}>
          <KPI value={pct(a.cancellationPct)} label="Cancellation rate" sub={`${a.bookingsArriving} arriving this period`} icon="x" />
        </div>

        <SectionLabel>Source mix · by room-nights</SectionLabel>
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="ralign">Bookings</th>
                  <th className="ralign">Room-nights</th>
                  <th className="ralign">Share</th>
                </tr>
              </thead>
              <tbody>
                {a.sourceMix.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--subtle)" }}>No stays in this period.</td></tr>
                ) : (
                  a.sourceMix.map((s) => (
                    <tr key={s.channel}>
                      <td><ChannelBadge name={s.channel} /></td>
                      <td className="ralign num">{s.bookings}</td>
                      <td className="ralign num">{s.roomNights}</td>
                      <td className="ralign">
                        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                          <div style={{ width: 56, height: 6, borderRadius: 99, background: "var(--sand)", overflow: "hidden" }}>
                            <div style={{ width: `${s.sharePct}%`, height: "100%", background: "var(--teal)", borderRadius: 99 }} />
                          </div>
                          <span className="num" style={{ fontWeight: 600, minWidth: 38, textAlign: "right" }}>{pct(s.sharePct)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
