import { describe, it, expect } from "vitest";
import { rosterHoursByStaff, attendanceCounts } from "@/lib/staff";

describe("rosterHoursByStaff", () => {
  it("sums scheduled hours per staff", () => {
    const h = rosterHoursByStaff([
      { staffId: "a", start: "09:00", end: "17:00" }, // 8
      { staffId: "a", start: "18:00", end: "20:30" }, // 2.5
      { staffId: "b", start: "10:00", end: "14:00" }, // 4
    ]);
    expect(h.a).toBe(10.5);
    expect(h.b).toBe(4);
  });

  it("wraps overnight shifts past midnight", () => {
    const h = rosterHoursByStaff([{ staffId: "n", start: "22:00", end: "06:00" }]); // 8
    expect(h.n).toBe(8);
  });
});

describe("attendanceCounts", () => {
  it("tallies present / absent / leave", () => {
    const c = attendanceCounts([
      { status: "present" }, { status: "present" }, { status: "absent" }, { status: "leave" },
    ]);
    expect(c).toEqual({ present: 2, absent: 1, leave: 1 });
  });
});
