import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getSummary } from "@/app/api/agent/owner/summary/route";
import { GET as getEscalations } from "@/app/api/agent/owner/escalations/route";

// The two read endpoints the OWNER console agent uses. Both are owner-only, so
// they 401 without the agent token. summary returns the daily-briefing shape;
// escalations returns only the still-open queue (open + in_progress).

const TEST_TOKEN = "test-agent-owner";
const TAG = `owner-${Date.now()}`;

function makeGet(path: string, token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request(`http://localhost${path}`, { method: "GET", headers });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
  await prisma.escalation.create({
    data: { source: "assistant", category: "booking", severity: "medium", status: "open", title: `${TAG}-open`, summary: "waiting on owner" },
  });
  await prisma.escalation.create({
    data: { source: "assistant", category: "booking", severity: "low", status: "resolved", title: `${TAG}-resolved`, summary: "already handled" },
  });
});

afterAll(async () => {
  await prisma.escalation.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("agent owner endpoints", () => {
  it("summary 401s without the token", async () => {
    expect((await getSummary(makeGet("/api/agent/owner/summary"))).status).toBe(401);
  });

  it("escalations 401s without the token", async () => {
    expect((await getEscalations(makeGet("/api/agent/owner/escalations"))).status).toBe(401);
  });

  it("summary returns the daily-briefing shape", async () => {
    const res = await getSummary(makeGet("/api/agent/owner/summary", TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(typeof data.occupancyPct).toBe("number");
    expect(data.counts).toMatchObject({ checkInsToday: expect.any(Number), arrivalsNext7: expect.any(Number) });
    expect(Array.isArray(data.arrivalsNext7)).toBe(true);
  });

  it("escalations returns open items but not resolved ones", async () => {
    const res = await getEscalations(makeGet("/api/agent/owner/escalations", TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const titles = data.items.map((i: { title: string }) => i.title);
    expect(titles).toContain(`${TAG}-open`);
    expect(titles).not.toContain(`${TAG}-resolved`);
  });
});
