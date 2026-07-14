import { describe, expect, it } from "vitest";
import { toSegments, type CalendarCell } from "@/lib/calendar-grid";

// The calendar grid is an HTML table, so the sum of every segment's colSpan MUST
// equal the number of days. Get it wrong and the row shears sideways — every cell
// after the mistake lands under the wrong date, which looks like a booking on the
// wrong day. That is a data-integrity bug wearing a layout costume, so it is
// pinned here rather than left to the eye.

const day = (n: number) => `2026-07-${String(n).padStart(2, "0")}`;

function cell(i: number, over: Partial<CalendarCell> = {}): CalendarCell {
  return { date: day(i + 1), state: "vacant", arriving: false, departing: false, ...over };
}

const stay = (id: string, name = "Guest") => ({
  state: "occupied" as const,
  reservation: { id, guestName: name, channelName: "Direct", nights: 3 },
});

describe("toSegments", () => {
  it("merges consecutive nights of the same stay into one bar", () => {
    const cells = [
      cell(0),
      cell(1, stay("r1")),
      cell(2, stay("r1")),
      cell(3, stay("r1")),
      cell(4),
    ];
    const segs = toSegments(cells);
    expect(segs.map((s) => [s.start, s.span])).toEqual([[0, 1], [1, 3], [4, 1]]);
    expect(segs[1].cell.reservation?.id).toBe("r1");
  });

  it("never merges vacant nights — each empty night is its own booking target", () => {
    const segs = toSegments([cell(0), cell(1), cell(2)]);
    expect(segs).toHaveLength(3);
    expect(segs.every((s) => s.span === 1)).toBe(true);
  });

  it("keeps two different stays apart even when they are back to back", () => {
    // One guest checks out and another checks in the same day: adjacent occupied
    // cells that must NOT become one bar with the wrong guest's name on it.
    const segs = toSegments([cell(0, stay("r1", "Asha")), cell(1, stay("r2", "Bilal"))]);
    expect(segs).toHaveLength(2);
    expect(segs[0].cell.reservation?.guestName).toBe("Asha");
    expect(segs[1].cell.reservation?.guestName).toBe("Bilal");
  });

  it("merges a block only while the reason is the same", () => {
    const cells = [
      cell(0, { state: "blocked", blockReason: "Repainting" }),
      cell(1, { state: "blocked", blockReason: "Repainting" }),
      cell(2, { state: "blocked", blockReason: "Deep clean" }),
    ];
    expect(toSegments(cells).map((s) => [s.start, s.span])).toEqual([[0, 2], [2, 1]]);
  });

  it("preserves the arriving flag on the first night of the bar", () => {
    const segs = toSegments([cell(0, { ...stay("r1"), arriving: true }), cell(1, stay("r1"))]);
    expect(segs).toHaveLength(1);
    expect(segs[0].cell.arriving).toBe(true);
  });

  it("spans always sum to the number of days — the table depends on it", () => {
    // A deliberately awkward fortnight: stays, a gap, a block, a conflict, more gaps.
    const cells: CalendarCell[] = [
      cell(0), cell(1),
      cell(2, stay("r1")), cell(3, stay("r1")), cell(4, stay("r1")), cell(5, stay("r1")),
      cell(6),
      cell(7, { state: "blocked", blockReason: "Repaint" }), cell(8, { state: "blocked", blockReason: "Repaint" }),
      cell(9, { state: "conflict", reservation: { id: "r9", guestName: "X", channelName: "Agoda", nights: 2 } }),
      cell(10, { state: "conflict", reservation: { id: "r9", guestName: "X", channelName: "Agoda", nights: 2 } }),
      cell(11), cell(12), cell(13),
    ];
    const segs = toSegments(cells);
    expect(segs.reduce((sum, s) => sum + s.span, 0)).toBe(cells.length);
    // …and the segments must tile the row in order, with no gaps or overlaps.
    let cursor = 0;
    for (const s of segs) {
      expect(s.start).toBe(cursor);
      cursor += s.span;
    }
    expect(cursor).toBe(cells.length);
  });

  it("handles an empty row", () => {
    expect(toSegments([])).toEqual([]);
  });
});
