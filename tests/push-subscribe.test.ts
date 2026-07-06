import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as subscribe, DELETE as unsubscribe } from "@/app/api/push/subscribe/route";

// /api/push/subscribe — stores/removes a browser Web Push subscription.
// (Owner auth is enforced by the edge middleware; here we test the handler.)

const ENDPOINT = `https://push.example.com/sub/${Date.now()}`;

function req(method: "POST" | "DELETE", body: unknown): Request {
  return new Request("http://localhost/api/push/subscribe", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: ENDPOINT } });
  await prisma.$disconnect();
});

describe("push subscribe endpoint", () => {
  it("stores a subscription (and upserts on repeat)", async () => {
    const r1 = await subscribe(req("POST", { endpoint: ENDPOINT, keys: { p256dh: "aaa", auth: "bbb" } }));
    expect(r1.status).toBe(201);
    const r2 = await subscribe(req("POST", { endpoint: ENDPOINT, keys: { p256dh: "ccc", auth: "ddd" } }));
    expect(r2.status).toBe(201);
    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: ENDPOINT } });
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe("ccc"); // updated, not duplicated
  });

  it("rejects a malformed body", async () => {
    const r = await subscribe(req("POST", { endpoint: "not-a-url" }));
    expect(r.status).toBe(422);
  });

  it("removes a subscription", async () => {
    const r = await unsubscribe(req("DELETE", { endpoint: ENDPOINT }));
    expect(r.status).toBe(200);
    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: ENDPOINT } });
    expect(rows).toHaveLength(0);
  });
});
