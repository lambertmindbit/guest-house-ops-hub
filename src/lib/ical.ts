// Minimal RFC 5545 iCalendar writer — no dependency. We emit all-day VEVENTs
// for busy periods. iCal's all-day DTEND is EXCLUSIVE, which matches our
// half-open [check_in, check_out) stays exactly, so a checkout day stays free
// for a same-day arrival on the OTA side too.

export type IcalEvent = {
  uid: string;
  start: Date; // inclusive, date-only (UTC midnight)
  end: Date; // exclusive, date-only (UTC midnight)
  summary: string;
};

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Fold lines longer than 75 octets per spec (continuation lines start with a space).
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildIcsFeed(calendarName: string, events: IcalEvent[]): string {
  const dtstamp = stamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Guest House Ops Hub//Phase 2//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start)}`,
      `DTEND;VALUE=DATE:${ymd(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
