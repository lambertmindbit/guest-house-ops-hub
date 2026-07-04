import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/assistant/message/route";

// The flag-gated transport (Phase 2). Proves the route falls back to the Phase-1
// stub when no agent is configured, and again when a configured agent is
// unreachable — so production never breaks before the sidecar is deployed.

function post(body: unknown): Request {
  return new Request("http://localhost/api/assistant/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readChunks(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

afterEach(() => {
  delete process.env.ASSISTANT_AGENT_URL;
  delete process.env.ASSISTANT_AGENT_TOKEN;
});

describe("assistant message transport", () => {
  it("422s on an empty message", async () => {
    expect((await POST(post({ message: "" }))).status).toBe(422);
  });

  it("with no agent configured, answers from the stub (NDJSON, ends with done)", async () => {
    const res = await POST(post({ message: "hi" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const chunks = await readChunks(res);
    expect(chunks[0].type).toBe("text");
    expect(chunks[chunks.length - 1]).toEqual({ type: "done" });
  });

  it("falls back to the stub when the configured agent is unreachable", async () => {
    // Reserved-TEST-domain URL that cannot resolve → proxy throws → stub fallback.
    process.env.ASSISTANT_AGENT_URL = "http://agent.invalid.test.localhost:1/chat";
    const res = await POST(post({ message: "help" }));
    expect(res.status).toBe(200);
    const chunks = await readChunks(res);
    expect(chunks.some((c) => c.type === "text")).toBe(true);
    expect(chunks[chunks.length - 1]).toEqual({ type: "done" });
  });
});
