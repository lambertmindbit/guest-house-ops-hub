import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/push", () => ({ sendOwnerPush: vi.fn(async () => ({ sent: 1, pruned: 0 })) }));
vi.mock("@/lib/conflicts", () => ({ countConflicts: vi.fn() }));

import { eventEnabled, notifyAfterSync } from "@/lib/notify";
import { sendOwnerPush } from "@/lib/push";
import { countConflicts } from "@/lib/conflicts";

const sp = vi.mocked(sendOwnerPush);
const cc = vi.mocked(countConflicts);
beforeEach(() => { sp.mockClear(); cc.mockReset(); });

describe("eventEnabled (GAP-14 toggles)", () => {
  it("defaults on; only an explicit false mutes; other events unaffected", () => {
    expect(eventEnabled(null, "conflict")).toBe(true);
    expect(eventEnabled({ pushConflicts: true }, "conflict")).toBe(true);
    expect(eventEnabled({ pushConflicts: false }, "conflict")).toBe(false);
    expect(eventEnabled({ pushConflicts: false }, "escalation")).toBe(true);
  });
});

describe("notifyAfterSync", () => {
  it("pushes a conflict alert only when the sync increases conflicts", async () => {
    cc.mockResolvedValue(3);
    await notifyAfterSync(1, [{ feedId: "a", label: "A", imported: 2 }]);
    expect(sp).toHaveBeenCalledWith(expect.objectContaining({ url: "/needs-you", tag: "conflicts" }));
  });

  it("pushes a stale-sync alert when a feed fails", async () => {
    cc.mockResolvedValue(0);
    await notifyAfterSync(0, [{ feedId: "a", label: "A", imported: 0, error: "boom" }]);
    expect(sp).toHaveBeenCalledWith(expect.objectContaining({ url: "/settings/feeds", tag: "stale-sync" }));
  });

  it("stays quiet when nothing got worse and no feed failed", async () => {
    cc.mockResolvedValue(1);
    await notifyAfterSync(1, [{ feedId: "a", label: "A", imported: 2 }]);
    expect(sp).not.toHaveBeenCalled();
  });
});
