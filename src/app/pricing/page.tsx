import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { quoteRoomType } from "@/lib/pricing";
import { todayDateOnly, addDays, parseDateOnly } from "@/lib/dates";
import { displayShortDate } from "@/lib/format";
import { PageHead, Icon } from "@/components/ui";
import { RateCalendar } from "@/components/RateCalendar";

export const dynamic = "force-dynamic";

const DAYS = 14;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const today = todayDateOnly();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? params.start! : today;
  const end = addDays(start, DAYS);
  const prev = addDays(start, -DAYS);
  const next = addDays(start, DAYS);

  const roomTypes = await prisma.roomType.findMany({ orderBy: { name: "asc" } });
  const quotes = await Promise.all(roomTypes.map((t) => quoteRoomType(t.id, start, end)));

  const dates = quotes[0]?.nights.map((n) => n.date) ?? [];
  const rows = roomTypes.map((t, i) => ({
    id: t.id,
    name: t.name,
    nights: quotes[i].nights.map((n) => ({
      date: n.date,
      rate: n.rate,
      isOverride: n.applied.includes("Override"),
      hasAdjust: n.applied.length > 0 && !n.applied.includes("Override"),
    })),
  }));

  const currency = quotes[0]?.currency ?? "INR";
  const sub = `${displayShortDate(parseDateOnly(start))} – ${displayShortDate(parseDateOnly(addDays(end, -1)))} · suggested nightly rates`;

  return (
    <main className="app-main">
      <div className="entrance">
        <PageHead title="Pricing" sub={sub} />

        <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "12px 0 2px" }}>
          <Link href={`/pricing?start=${prev}`} className="btn btn--ghost btn--sm" aria-label="Previous"><Icon name="chevronL" size={16} /></Link>
          <Link href={`/pricing?start=${next}`} className="btn btn--ghost btn--sm" aria-label="Next"><Icon name="chevronR" size={16} /></Link>
          <Link href="/pricing" className="btn btn--ghost btn--sm">Today</Link>
          <Link href="/settings/pricing" className="btn btn--ghost btn--sm">Pricing rules</Link>
          <form method="get" className="row" style={{ gap: 6, marginLeft: "auto" }}>
            <input type="date" name="start" defaultValue={start} className="input" style={{ width: 152, padding: "8px 11px", fontSize: 14 }} />
            <button className="btn btn--ghost btn--sm">Go</button>
          </form>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-subtle)", margin: "12px 0", lineHeight: 1.5 }}>
          These are advisory rates from your pricing rules. Tap any cell to pin a manual rate (an override) for that date.
          A <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>dot</span> marks an override; italics mark a rule adjustment.
        </p>

        {roomTypes.length === 0 ? (
          <div className="empty">No room types yet — add some in Settings.</div>
        ) : (
          <RateCalendar dates={dates} rows={rows} today={today} currency={currency} />
        )}
      </div>
    </main>
  );
}
