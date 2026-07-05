import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/public/assistant/route";

// The public guest widget endpoint: dark by default, rate-limited, and
// (with no agent configured) answers from the stub. Booking behaviour (request
// vs reservation) lives in the agent's public mode, verified separately.

function post(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/public/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  delete process.env.PUBLIC_CHAT_ENABLED;
  delete process.env.ASSISTANT_AGENT_URL;
});

describe("public assistant endpoint", () => {
  it("is 404 (dark) unless PUBLIC_CHAT_ENABLED=true", async () => {
    expect((await POST(post({ message: "hi" }))).status).toBe(404);
  });

  it("streams from the stub when enabled and no agent is configured", async () => {
    process.env.PUBLIC_CHAT_ENABLED = "true";
    const res = await POST(post({ message: "hi" }, "9.9.9.1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const chunks = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(chunks[chunks.length - 1]).toEqual({ type: "done" });
  });

  it("rate-limits a noisy IP with a 429 + Retry-After", async () => {
    process.env.PUBLIC_CHAT_ENABLED = "true";
    const ip = "5.5.5.5";
    let last: Response | undefined;
    for (let i = 0; i < 25; i++) last = await POST(post({ message: "hi" }, ip));
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBeTruthy();
  });
});
