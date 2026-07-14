// The calendar's PURE shape logic — no Prisma, no server imports.
//
// This lives apart from lib/calendar.ts on purpose: CalendarBoard is a client
// component, and importing anything from lib/calendar (which pulls in prisma →
// node:async_hooks) drags the whole server stack into the browser bundle and
// fails the build. Types alone would be fine (they erase); `toSegments` is a real
// runtime value, so it needs a module the client can safely reach.

export type CellState = "vacant" | "occupied" | "blocked" | "conflict";

export type CalendarCell = {
  date: string;
  state: CellState;
  arriving: boolean;
  departing: boolean;
  reservation?: {
    id: string;
    guestName: string;
    channelName: string;
    /** Nights in the WHOLE stay, not just the part visible in this window — a bar
     *  clipped by the grid edge must still tell the truth about its length. */
    nights: number;
    /** Owner-only. Absent unless getCalendar was called with includeMoney. */
    balanceDue?: number;
  };
  blockReason?: string | null;
};

/** One run of adjacent cells that mean the same thing — the unit the grid draws. */
export type CalendarSegment = {
  /** Column index of the first cell. */
  start: number;
  /** How many columns it covers (the table's colSpan). */
  span: number;
  /** The first cell; carries the state, reservation and block reason for the run. */
  cell: CalendarCell;
};

/**
 * Merge each stay into a single segment, so a 4-night booking draws as ONE bar
 * rather than four identical truncated chips.
 *
 * Vacant cells are deliberately never merged: each empty night stays its own cell
 * so it can be its own "book this room on this date" target.
 *
 * The sum of every span always equals cells.length — the table's column count
 * depends on it, and a colSpan that overruns silently shears the row, putting
 * every later booking under the wrong date.
 */
export function toSegments(cells: CalendarCell[]): CalendarSegment[] {
  // Two adjacent cells merge only if this key matches. Null means "never merge".
  const key = (c: CalendarCell): string | null =>
    c.state === "vacant" ? null
    : c.state === "blocked" ? `blocked:${c.blockReason ?? ""}`
    : `${c.state}:${c.reservation?.id ?? ""}`;

  const out: CalendarSegment[] = [];
  for (let i = 0; i < cells.length; i++) {
    const k = key(cells[i]);
    const prev = out[out.length - 1];
    // `k !== null` must be checked first: two vacant cells both key to null, and
    // null === null would otherwise merge every empty night into one dead block.
    if (k !== null && prev && key(prev.cell) === k) prev.span += 1;
    else out.push({ start: i, span: 1, cell: cells[i] });
  }
  return out;
}
