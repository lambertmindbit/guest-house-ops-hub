import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listActivePolicies, upsertPolicy } from "@/lib/policies";
import { GET as getAgentPolicies } from "@/app/api/agent/policies/route";

// Owner-editable assistant policies: the lib upserts one row per intent; the
// agent seam returns only active, non-empty guidance behind the token.

const TEST_TOKEN = "test-agent-policies";

function makeGet(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/policies", { method: "GET", headers });
}

beforeAll(() => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
});

afterEach(async () => {
  await prisma.assistantPolicy.deleteMany({ where: { intent: { startsWith: "test-" } } });
});

describe("assistant policies", () => {
  it("upsertPolicy creates then updates a single row per intent", async () => {
    await upsertPolicy("test-booking", { instructions: "First." });
    await upsertPolicy("test-booking", { instructions: "Second." });
    const rows = await prisma.assistantPolicy.findMany({ where: { intent: "test-booking" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].instructions).toBe("Second.");
  });

  it("listActivePolicies skips empty and inactive rows", async () => {
    await upsertPolicy("test-a", { instructions: "Keep me." });
    await upsertPolicy("test-b", { instructions: "   " }); // empty -> skipped
    await upsertPolicy("test-c", { instructions: "Hidden.", active: false }); // inactive -> skipped
    const active = await listActivePolicies();
    const mine = active.filter((p) => p.intent.startsWith("test-"));
    expect(mine).toEqual([{ intent: "test-a", instructions: "Keep me." }]);
  });

  it("agent seam 401s without the token", async () => {
    expect((await getAgentPolicies(makeGet())).status).toBe(401);
  });

  it("agent seam returns active policies as {intent, instructions}", async () => {
    await upsertPolicy("test-general", { instructions: "Be warm." });
    const res = await getAgentPolicies(makeGet(TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const mine = data.filter((p: { intent: string }) => p.intent.startsWith("test-"));
    expect(mine).toContainEqual({ intent: "test-general", instructions: "Be warm." });
  });
});
