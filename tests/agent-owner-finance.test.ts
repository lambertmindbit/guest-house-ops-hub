import { afterAll, describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getFinance } from "@/app/api/agent/owner/finance/route";

// GET /api/agent/owner/finance — the owner console money/performance read.
// Owner-only (401 without token); returns the combined revenue + performance
// shape; honours an explicit from/to range.

const TEST_TOKEN = "test-agent-finance";

function makeGet(qs = "", token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request(`http://localhost/api/agent/owner/finance${qs}`, { method: "GET", headers });
}

beforeAll(() => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("agent owner finance endpoint", () => {
  it("401s without the token", async () => {
    expect((await getFinance(makeGet())).status).toBe(401);
  });

  it("returns the combined revenue + performance shape (defaults to current month)", async () => {
    const res = await getFinance(makeGet("", TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(typeof data.from).toBe("string");
    expect(typeof data.to).toBe("string");
    expect(data.revenue).toMatchObject({ gross: expect.any(Number), net: expect.any(Number), outstanding: expect.any(Number) });
    expect(typeof data.occupancyPct).toBe("number");
    expect(typeof data.adr).toBe("number");
    expect(Array.isArray(data.byChannel)).toBe(true);
  });

  it("honours an explicit from/to range", async () => {
    const res = await getFinance(makeGet("?from=2026-01-01&to=2026-02-01", TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.from).toBe("2026-01-01");
    expect(data.to).toBe("2026-02-01");
  });
});
