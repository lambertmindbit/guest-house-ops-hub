import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/agent/escalations/route";

// Route-level integration test for the agent escalation seam.
// Proves:
//   (1) the token gate — 401 without AGENT_TOKEN, 201 with it
//   (2) the created escalation appears in the DB
//   (3) posting the same externalId a second time de-dupes (200, deduped:true)

const TEST_TOKEN = "test-agent-token-phase-a";
const TAG = `test-esc-${Date.now()}`;

function makeRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/escalations", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const validPayload = {
  source: "cab",
  category: "driver",
  severity: "high",
  title: `${TAG} driver cancelled`,
  summary: "Test escalation for Phase A integration test.",
  reason: "No fallback accepted.",
  raisedBy: { name: "Test Guest", contact: "+91-0000000000", lang: "en" },
  externalId: `${TAG}:evt-1`,
};

beforeAll(() => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
});

afterAll(async () => {
  await prisma.escalation.deleteMany({ where: { externalId: { startsWith: TAG } } });
  delete process.env.AGENT_TOKEN;
});

describe("POST /api/agent/escalations — token gate", () => {
  it("returns 401 when no token is supplied", async () => {
    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token is wrong", async () => {
    const res = await POST(makeRequest(validPayload, "wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 422 on a valid token but invalid body", async () => {
    const res = await POST(makeRequest({ source: "cab" /* missing required fields */ }, TEST_TOKEN));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/agent/escalations — happy path", () => {
  it("creates an escalation and returns 201 with the id", async () => {
    const res = await POST(makeRequest(validPayload, TEST_TOKEN));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBeTruthy();
    expect(json.data.status).toBe("open");
    expect(json.data.deduped).toBe(false);

    const row = await prisma.escalation.findUnique({ where: { externalId: validPayload.externalId } });
    expect(row).not.toBeNull();
    expect(row?.title).toBe(validPayload.title);
    expect(row?.severity).toBe("high");
  });

  it("de-dupes on a repeated externalId — returns 200 with deduped:true", async () => {
    const res = await POST(makeRequest(validPayload, TEST_TOKEN));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deduped).toBe(true);
  });
});
