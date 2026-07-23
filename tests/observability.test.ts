import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";
import { GET as health } from "@/app/api/health/route";
import { notifyCronFailure } from "@/lib/notify";

// GAP-17: observability. Error webhook forwarding, the health endpoint, and
// cron-failure alerting that never masks the underlying error.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("error webhook (logError → ERROR_WEBHOOK_URL)", () => {
  it("POSTs an error to the webhook when configured, Slack/Discord-compatible", async () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/incoming");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    logError("test.boom", new Error("kaboom"), { job: "x" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example/incoming");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.text).toContain("kaboom"); // Slack renders `text`
    expect(body.content).toContain("kaboom"); // Discord renders `content`
    expect(body.event).toBe("test.boom");
  });

  it("does NOT post when the webhook is unset (off by default)", () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    logError("test.quiet", new Error("nope"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failing webhook never throws into the caller", () => {
    vi.stubEnv("ERROR_WEBHOOK_URL", "https://hooks.example/incoming");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(() => logError("test.safe", new Error("x"))).not.toThrow();
  });
});

describe("/api/health", () => {
  it("returns 200 and status ok when the database is reachable", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
    expect(typeof body.dbLatencyMs).toBe("number");
  });
});

describe("notifyCronFailure", () => {
  it("logs the failure and never throws, even if the push seam is down", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifyCronFailure("sync", new Error("feed unreachable"))).resolves.toBeUndefined();
    // The specific, greppable cron.failed event was logged.
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("cron.failed"))).toBe(true);
  });
});
