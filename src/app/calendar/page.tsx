import { getCalendar } from "@/lib/calendar";
import { todayDateOnly, parseDateOnly, addDays } from "@/lib/dates";
import { displayShortDate } from "@/lib/format";
import { CalendarBoard } from "@/components/CalendarBoard";

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
  const prev = addDays(start, -DAYS);
  const next = addDays(start, DAYS);

  const cal = await getCalendar(start, DAYS);
  const sub = `${displayShortDate(parseDateOnly(cal.dates[0]))} – ${displayShortDate(
    parseDateOnly(cal.dates[cal.dates.length - 1]),
  )} · ${cal.rows.length} rooms`;

  return (
    <main className="app-main">
      <div className="entrance">
        <CalendarBoard
          dates={cal.dates}
          rows={cal.rows}
          today={today}
          sub={sub}
          nav={{ prev: `/calendar?start=${prev}`, next: `/calendar?start=${next}`, today: "/calendar" }}
        />
      </div>
    </main>
  );
}
