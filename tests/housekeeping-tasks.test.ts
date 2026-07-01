import { describe, it, expect } from "vitest";
import { checklistProgress, allDone, DEFAULT_CHECKLIST } from "@/lib/housekeeping";

describe("housekeeping checklist", () => {
  it("counts progress", () => {
    const items = [
      { label: "Bathroom", done: true },
      { label: "Towels", done: false },
      { label: "Trash", done: true },
    ];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 3 });
  });

  it("allDone only when every item is checked", () => {
    expect(allDone([{ label: "a", done: true }, { label: "b", done: true }])).toBe(true);
    expect(allDone([{ label: "a", done: true }, { label: "b", done: false }])).toBe(false);
    expect(allDone([])).toBe(false);
  });

  it("ships a non-empty default checklist", () => {
    expect(DEFAULT_CHECKLIST.length).toBeGreaterThan(0);
  });
});
