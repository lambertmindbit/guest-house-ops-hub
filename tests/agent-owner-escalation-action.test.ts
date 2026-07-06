import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as actOn } from "@/app/api/agent/owner/escalations/[id]/route";

// POST /api/agent/owner/escalations/[id] — the owner acts on a queue item.
// Owner-only (401 without token); resolves an open item; 404 for an unknown id.

const TEST_TOKEN = "test-agent-esc-action";
const TAG = `escact-${Date.now()}`;
let openId = "";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makePost(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/owner/escalations/x", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
  const e = await prisma.escalation.create({
    data: { source: "assistant", category: "booking", severity: "medium", status: "open", title: `${TAG}-open`, summary: "please act" },
  });
  openId = e.id;
});

afterAll(async () => {
  await prisma.escalation.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("agent owner escalation-action endpoint", () => {
  it("401s without the token", async () => {
    expect((await actOn(makePost({ status: "resolved" }), ctx(openId))).status).toBe(401);
  });

  it("404s for an unknown id", async () => {
    expect((await actOn(makePost({ status: "resolved" }, TEST_TOKEN), ctx("does-not-exist"))).status).toBe(404);
  });

  it("resolves an open item", async () => {
    const res = await actOn(makePost({ status: "resolved", resolutionNote: "handled by owner" }, TEST_TOKEN), ctx(openId));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ id: openId, status: "resolved" });
    const row = await prisma.escalation.findUnique({ where: { id: openId } });
    expect(row?.status).toBe("resolved");
    expect(row?.resolvedAt).not.toBeNull();
  });
});
