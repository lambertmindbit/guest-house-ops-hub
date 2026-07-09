import type { Analytics } from "@/lib/analytics";

// Turn an Analytics snapshot into a labelled, multi-section CSV the owner can
// open in Excel / Google Sheets. Sections are blank-line separated — every
// spreadsheet app reads that as separate tables. Numbers are emitted raw (no ₹,
// no %) so they stay numeric in the sheet; percentages are rounded to 1 dp.

const round1 = (n: number) => Math.round(n * 10) / 10;

// RFC-4180 escaping: wrap in quotes and double any embedded quote when a field
// contains a comma, quote, or newline.
function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(...cells: (string | number)[]): string {
  return cells.map(cell).join(",");
}

export function analyticsCsv(a: Analytics): string {
  const lines: string[] = [];

  lines.push(row("Guest House — Analytics"));
  lines.push(row("Period", a.from, a.to));
  lines.push(row("Rooms", a.rooms));
  lines.push(row("Nights", a.nights));
  lines.push("");

  lines.push(row("Metric", "Value"));
  lines.push(row("Occupancy %", round1(a.occupancyPct)));
  lines.push(row("ADR", Math.round(a.adr)));
  lines.push(row("RevPAR", Math.round(a.revpar)));
  lines.push(row("Avg length of stay (nights)", round1(a.avgLengthOfStay)));
  lines.push(row("Cancellation %", round1(a.cancellationPct)));
  lines.push(row("Bookings arriving", a.bookingsArriving));
  lines.push("");

  lines.push(row("Source mix"));
  lines.push(row("Channel", "Bookings", "Room-nights", "Share %"));
  for (const s of a.sourceMix) lines.push(row(s.channel, s.bookings, s.roomNights, round1(s.sharePct)));
  lines.push("");

  lines.push(row("Occupancy by room type"));
  lines.push(row("Room type", "Sold room-nights", "Available room-nights", "Occupancy %"));
  for (const t of a.byRoomType) lines.push(row(t.name, t.soldRoomNights, t.availableRoomNights, round1(t.occupancyPct)));
  lines.push("");

  lines.push(row("Daily occupancy"));
  lines.push(row("Date", "Occupancy %"));
  for (const p of a.trend) lines.push(row(p.date, round1(p.occupancyPct)));

  return lines.join("\n");
}
