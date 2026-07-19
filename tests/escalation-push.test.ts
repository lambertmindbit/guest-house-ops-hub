import { afterAll, describe, expect, it, vi } from "vitest";

// createEscalation dynamic-imports notify; mock it so we can assert the severity gate.
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createEscalation } from "@/lib/escalations";
import { notifyOwner } from "@/lib/notify";

const no = vi.mocked(notifyOwner);
const TAG = `escpush-${Date.now()}`;

afterAll(async () => {
  await prisma.escalation.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("escalation push gate (GAP-14 / US-501)", () => {
  it("does NOT push for a low/medium escalation", async () => {
    no.mockClear();
    await createEscalation({ source: "manual", title: `${TAG}-med`, summary: "x", severity: "medium" });
    expect(no).not.toHaveBeenCalled();
  });

  it("pushes for a high and a critical escalation, deep-linked to the queue", async () => {
    no.mockClear();
    await createEscalation({ source: "manual", title: `${TAG}-high`, summary: "x", severity: "high" });
    expect(no).toHaveBeenCalledWith("escalation", expect.objectContaining({ url: "/needs-you" }));

    no.mockClear();
    await createEscalation({ source: "manual", title: `${TAG}-crit`, summary: "x", severity: "critical" });
    expect(no).toHaveBeenCalledWith("escalation", expect.anything());
  });
});
