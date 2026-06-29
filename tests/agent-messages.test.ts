import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/agent/messages/route";

// Integration tests for Phase F — agent message seam.
// Proves:
//   (1) POST without token → 401
//   (2) POST with invalid body → 422
//   (3) POST with valid body → 201, message logged with status='logged'
//   (4) logged message can be found in the DB

const TEST_TOKEN = "test-agent-token-phase-f";
const TAG = `test-msg-f-${Date.now()}`;

function makePost(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
});

afterAll(async () => {
  await prisma.outboundMessage.deleteMany({ where: { to: { startsWith: TAG } } });
  delete process.env.AGENT_TOKEN;
});

describe("POST /api/agent/messages", () => {
  it("returns 401 without token", async () => {
    const res = await POST(makePost({ source: "assistant", channel: "whatsapp", to: `${TAG}-phone`, body: "hi" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 for missing required fields", async () => {
    const res = await POST(makePost({ source: "assistant" }, TEST_TOKEN));
    expect(res.status).toBe(422);
  });

  it("returns 201 and creates a logged message", async () => {
    const res = await POST(
      makePost(
        {
          source: "assistant",
          channel: "whatsapp",
          to: `${TAG}-phone`,
          body: "Your booking is confirmed for tomorrow.",
        },
        TEST_TOKEN,
      ),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBeTruthy();
    expect(json.data.status).toBe("logged");

    const row = await prisma.outboundMessage.findUnique({ where: { id: json.data.id } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("logged");
    expect(row?.channel).toBe("whatsapp");
    expect(row?.body).toContain("confirmed");
  });
});
