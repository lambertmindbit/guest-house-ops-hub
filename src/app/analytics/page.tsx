import { getAnalytics } from "@/lib/analytics";
import { currentMonthRange } from "@/lib/finance";
import { displayINR } from "@/lib/format";
import { PageHead, SectionLabel, RangeForm, ChannelBadge } from "@/components/ui";
import { OccupancyTrendChart, SourceMixChart, RevenueByChannelChart, RoomTypeChart } from "@/components/AnalyticsCharts";

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
      <div className="entrance">
        <PageHead
          title="Analytics"
          sub={`${from} – ${to} · ${a.nights} night${a.nights === 1 ? "" : "s"}, ${a.rooms} rooms`}
          right={
            <a className="btn btn--ghost btn--sm" href={`/api/analytics/export?from=${from}&to=${to}`} download>
              Download CSV
            </a>
          }
        />
        <RangeForm from={from} to={to} />

        <div className="kpi-strip" style={{ marginTop: 14 }}>
          <div className="kpi-panel kpi-panel--verdict">
            <div className="kpi-eyebrow">Occupancy</div>
            <div className="kpi-num">{pct(a.occupancyPct)}</div>
            <div className="kpi-ctx">{a.soldRoomNights}/{a.availableRoomNights} room-nights</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">ADR</div>
            <div className="kpi-num">{displayINR(a.adr)}</div>
            <div className="kpi-ctx">avg nightly rate</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">RevPAR</div>
            <div className="kpi-num">{displayINR(a.revpar)}</div>
            <div className="kpi-ctx">rev / available room</div>
          </div>
          <div className="kpi-panel">
            <div className="kpi-eyebrow">Avg stay</div>
            <div className="kpi-num">{a.avgLengthOfStay.toFixed(1)}</div>
            <div className="kpi-ctx">nights</div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-meta)", margin: "10px 2px 0" }}>
          Cancellation rate <b style={{ color: "var(--ink)" }}>{pct(a.cancellationPct)}</b> · {a.bookingsArriving} arriving this period
        </p>

        <SectionLabel>Source mix · by room-nights</SectionLabel>
        {a.sourceMix.length > 0 && (
          <div className="card card--pad" style={{ marginBottom: 10 }}>
            <SourceMixChart sourceMix={a.sourceMix} />
          </div>
        )}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="r">Bookings</th>
                <th className="r">Room-nights</th>
                <th className="r">Share</th>
              </tr>
            </thead>
            <tbody>
              {a.sourceMix.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-subtle)" }}>No stays in this period.</td></tr>
              ) : (
                a.sourceMix.map((s) => (
                  <tr key={s.channel}>
                    <td><ChannelBadge name={s.channel} /></td>
                    <td className="r num">{s.bookings}</td>
                    <td className="r num">{s.roomNights}</td>
                    <td className="r">
                      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                        <div style={{ width: 56, height: 6, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
                          <div style={{ width: `${s.sharePct}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} />
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

        {/* Revenue by channel — money, not room-nights (a different ranking). */}
        <SectionLabel>Revenue by channel</SectionLabel>
        <div className="card card--pad">
          {a.sourceMix.length === 0 ? (
            <div className="empty">No revenue in this period.</div>
          ) : (
            <RevenueByChannelChart sourceMix={a.sourceMix} />
          )}
        </div>

        {/* Occupancy trend across the period — absolute 0–100% scale. */}
        <SectionLabel>Occupancy trend</SectionLabel>
        <div className="card card--pad">
          {a.trend.length === 0 ? (
            <div className="empty">No nights in this period.</div>
          ) : (
            <OccupancyTrendChart trend={a.trend} />
          )}
        </div>

        {/* Occupancy by room type. */}
        <SectionLabel>Occupancy by room type</SectionLabel>
        <div className="card card--pad">
          {a.byRoomType.length === 0 ? (
            <div className="empty">No room types yet.</div>
          ) : (
            <RoomTypeChart byRoomType={a.byRoomType} />
          )}
        </div>
      </div>
    </main>
  );
}
