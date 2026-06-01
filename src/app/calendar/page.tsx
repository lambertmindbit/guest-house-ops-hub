import Link from "next/link";
import { getCalendar, type CalendarCell } from "@/lib/calendar";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";
import { displayShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAYS = 14;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const today = todayDateOnly();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? params.start! : today;
  const cal = await getCalendar(start, DAYS);

  const prev = addDays(start, -DAYS);
  const next = addDays(start, DAYS);

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href={`/calendar?start=${prev}`} label="‹ Prev" />
          <NavLink href="/calendar" label="Today" />
          <NavLink href={`/calendar?start=${next}`} label="Next ›" />
        </nav>
      </header>

      <Legend />

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-28 border-b border-r border-neutral-200 bg-neutral-50 p-2 text-left font-medium">
                Room
              </th>
              {cal.dates.map((d) => (
                <th
                  key={d}
                  className={`w-24 border-b border-neutral-200 p-2 font-medium ${
                    d === today ? "bg-amber-50 text-amber-700" : "bg-neutral-50"
                  }`}
                >
                  {displayShortDate(parseDateOnly(d))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cal.rows.map((row) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 border-r border-t border-neutral-200 bg-white p-2 text-left font-medium">
                  <div>{row.label}</div>
                  <div className="font-normal text-neutral-400">{row.roomTypeName}</div>
                </th>
                {row.cells.map((cell) => (
                  <Cell key={cell.date} cell={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Cell({ cell }: { cell: CalendarCell }) {
  const base = "h-14 border-t border-neutral-100 p-1 align-top text-[11px] leading-tight";
  const markers = `${cell.arriving ? "border-l-4 border-l-green-500" : ""} ${
    cell.departing ? "border-r-4 border-r-amber-400" : ""
  }`;

  if (cell.state === "conflict") {
    return (
      <td className={`${base} ${markers} bg-red-500 font-semibold text-white`}>
        <Link href={`/reservations/${cell.reservation!.id}`} className="block h-full">
          Conflict
        </Link>
      </td>
    );
  }

  if (cell.state === "occupied") {
    return (
      <td className={`${base} ${markers} bg-blue-100`}>
        <Link href={`/reservations/${cell.reservation!.id}`} className="block h-full">
          <div className="truncate font-medium text-blue-900">
            {firstName(cell.reservation!.guestName)}
          </div>
          <div className="truncate text-blue-600">{cell.reservation!.channelName}</div>
        </Link>
      </td>
    );
  }

  if (cell.state === "blocked") {
    return (
      <td className={`${base} ${markers} bg-neutral-200 text-neutral-600`}>
        <span className="italic">Blocked</span>
        {cell.blockReason && <div className="truncate text-neutral-500">{cell.blockReason}</div>}
      </td>
    );
  }

  return <td className={`${base} ${markers} bg-white`} />;
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded border border-neutral-200 px-2 py-1 hover:bg-neutral-50">
      {label}
    </Link>
  );
}

function Legend() {
  const items: { label: string; className: string }[] = [
    { label: "Vacant", className: "bg-white border border-neutral-300" },
    { label: "Occupied", className: "bg-blue-100" },
    { label: "Blocked", className: "bg-neutral-200" },
    { label: "Conflict", className: "bg-red-500" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded ${i.className}`} />
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-1.5 bg-green-500" /> Arriving
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-1.5 bg-amber-400" /> Departing
      </span>
    </div>
  );
}
