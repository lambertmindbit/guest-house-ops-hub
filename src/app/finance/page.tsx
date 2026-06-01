import Link from "next/link";
import { getFinanceSummary, currentMonthRange } from "@/lib/finance";
import { displayINR } from "@/lib/format";

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
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Finance</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Bookings arriving between {from} and {to} (exclusive). {t.bookings} booking
        {t.bookings === 1 ? "" : "s"}.
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

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gross revenue" value={displayINR(t.gross)} />
        <Stat label="OTA commission" value={displayINR(t.commission)} />
        <Stat label="Net to you" value={displayINR(t.net)} strong />
        <Stat label="Outstanding" value={displayINR(t.outstanding)} amber={t.outstanding > 0} />
      </section>

      <h2 className="mb-2 text-sm font-semibold text-neutral-700">By channel</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="p-2">Channel</th>
              <th className="p-2 text-right">Bookings</th>
              <th className="p-2 text-right">Gross</th>
              <th className="p-2 text-right">Commission</th>
              <th className="p-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {summary.byChannel.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-neutral-400">
                  No bookings in this period.
                </td>
              </tr>
            ) : (
              summary.byChannel.map((c) => (
                <tr key={c.channel} className="border-t border-neutral-100">
                  <td className="p-2 font-medium">{c.channel}</td>
                  <td className="p-2 text-right tabular-nums">{c.bookings}</td>
                  <td className="p-2 text-right tabular-nums">{displayINR(c.gross)}</td>
                  <td className="p-2 text-right tabular-nums">{displayINR(c.commission)}</td>
                  <td className="p-2 text-right font-medium tabular-nums">{displayINR(c.net)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {summary.outstanding.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Balances due</h2>
          <ul className="space-y-2">
            {summary.outstanding.map((o) => (
              <li
                key={o.reservationId}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
              >
                <Link href={`/reservations/${o.reservationId}`} className="font-medium hover:underline">
                  {o.guestName} · Room {o.roomLabel}
                </Link>
                <span className="font-medium text-amber-800">{displayINR(o.balance)} due</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function Stat({
  label,
  value,
  strong,
  amber,
}: {
  label: string;
  value: string;
  strong?: boolean;
  amber?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        amber ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className={`text-lg font-semibold tabular-nums ${strong ? "text-green-700" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
