import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as postTurn } from "@/app/api/agent/turns/route";

// POST /api/agent/turns — the agent logs one conversation turn. Owner-only
// (401 without token); creates a row; skips an empty reply.

const TEST_TOKEN = "test-agent-turns";
const TAG = `turn-${Date.now()}`;

function makePost(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/turns", { method: "POST", headers, body: JSON.stringify(body) });
}

beforeAll(() => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
});

afterAll(async () => {
  await prisma.conversationTurn.deleteMany({ where: { sessionId: TAG } });
  await prisma.$disconnect();
});

describe("agent turns endpoint", () => {
  it("401s without the token", async () => {
    expect((await postTurn(makePost({ sessionId: TAG, mode: "owner", userMessage: "hi", reply: "hello" }))).status).toBe(401);
  });

  it("logs a turn", async () => {
    const res = await postTurn(makePost({ sessionId: TAG, mode: "public", userMessage: "is there wifi?", reply: "Yes, free wifi." }, TEST_TOKEN));
    expect(res.status).toBe(201);
    const rows = await prisma.conversationTurn.findMany({ where: { sessionId: TAG } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mode: "public", userMessage: "is there wifi?", reply: "Yes, free wifi." });
  });

  it("skips an empty reply", async () => {
    const res = await postTurn(makePost({ sessionId: TAG, mode: "owner", userMessage: "hmm", reply: "   " }, TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.skipped).toBe(true);
    const rows = await prisma.conversationTurn.findMany({ where: { sessionId: TAG } });
    expect(rows).toHaveLength(1); // still just the one from before
  });
});
