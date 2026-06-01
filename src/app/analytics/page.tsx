import { getAnalytics } from "@/lib/analytics";
import { currentMonthRange } from "@/lib/finance";
import { displayINR } from "@/lib/format";

export const dynamic = "force-dynamic";

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pct = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)}%`;

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
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Analytics</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {from} to {to} ({a.nights} night{a.nights === 1 ? "" : "s"}, {a.rooms} rooms).
      </p>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">From</span>
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-neutral-500">To</span>
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Apply
        </button>
      </form>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Occupancy" value={pct(a.occupancyPct)} hint={`${a.soldRoomNights}/${a.availableRoomNights} room-nights`} />
        <Stat label="ADR" value={displayINR(a.adr)} hint="avg nightly rate" />
        <Stat label="RevPAR" value={displayINR(a.revpar)} hint="rev / available room" />
        <Stat label="Avg stay" value={`${a.avgLengthOfStay.toFixed(1)} nts`} />
        <Stat label="Cancellation" value={pct(a.cancellationPct)} hint={`${a.bookingsArriving} arriving`} />
      </section>

      <h2 className="mb-2 text-sm font-semibold text-neutral-700">Source mix (by room-nights)</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="p-2">Channel</th>
              <th className="p-2 text-right">Bookings</th>
              <th className="p-2 text-right">Room-nights</th>
              <th className="p-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {a.sourceMix.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-3 text-center text-neutral-400">
                  No stays in this period.
                </td>
              </tr>
            ) : (
              a.sourceMix.map((s) => (
                <tr key={s.channel} className="border-t border-neutral-100">
                  <td className="p-2 font-medium">{s.channel}</td>
                  <td className="p-2 text-right tabular-nums">{s.bookings}</td>
                  <td className="p-2 text-right tabular-nums">{s.roomNights}</td>
                  <td className="p-2 text-right tabular-nums">{pct(s.sharePct)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {hint && <div className="text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}
