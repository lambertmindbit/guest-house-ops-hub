import { getCalendar } from "@/lib/calendar";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";
import { displayShortDate } from "@/lib/format";
import { CalendarBoard, type CalView } from "@/components/CalendarBoard";

export const dynamic = "force-dynamic";

const VIEWS = ["day", "week", "2wk", "month"] as const;

// First day of month (y, m) as YYYY-MM-DD; Date.UTC normalises month over/underflow.
function monthStart(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; start?: string }>;
}) {
  const params = await searchParams;
  const today = todayDateOnly();
  const view: CalView = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as CalView)
    : "2wk";
  const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? params.start! : today;

  // Each view fixes the window length and how prev/next page through time.
  // "day" loads a 14-day strip; the agenda picks one day within it.
  let start: string;
  let days: number;
  let prev: string;
  let next: string;
  if (view === "month") {
    const base = parseDateOnly(rawStart);
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    start = monthStart(y, m);
    days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // last day-of-month number
    prev = monthStart(y, m - 1);
    next = monthStart(y, m + 1);
  } else {
    days = view === "week" ? 7 : 14;
    start = rawStart;
    prev = addDays(start, -days);
    next = addDays(start, days);
  }

  const cal = await getCalendar(start, days);
  const sub = `${displayShortDate(parseDateOnly(cal.dates[0]))} – ${displayShortDate(
    parseDateOnly(cal.dates[cal.dates.length - 1]),
  )} · ${cal.rows.length} rooms`;

  return (
    <main className="app-main">
      <div className="entrance">
        <CalendarBoard
          view={view}
          dates={cal.dates}
          rows={cal.rows}
          today={today}
          sub={sub}
          start={start}
          nav={{
            prev: `/calendar?view=${view}&start=${prev}`,
            next: `/calendar?view=${view}&start=${next}`,
            today: `/calendar?view=${view}`,
          }}
        />
      </div>
    </main>
  );
}
