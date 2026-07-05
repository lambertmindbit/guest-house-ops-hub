import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getFaq } from "@/app/api/agent/faq/route";

// GET /api/agent/faq — the read the guest assistant uses. 401 without token;
// returns only ACTIVE entries, shaped as question/answer/category.

const TEST_TOKEN = "test-agent-faq";
const TAG = `faq-${Date.now()}`;

function makeGet(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-agent-token"] = token;
  return new Request("http://localhost/api/agent/faq", { method: "GET", headers });
}

beforeAll(async () => {
  process.env.AGENT_TOKEN = TEST_TOKEN;
  await prisma.faqEntry.create({ data: { question: `${TAG}-active`, answer: "yes we do", category: "Facilities", active: true, sortOrder: 1 } });
  await prisma.faqEntry.create({ data: { question: `${TAG}-hidden`, answer: "hidden answer", active: false, sortOrder: 2 } });
});

afterAll(async () => {
  await prisma.faqEntry.deleteMany({ where: { question: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("agent FAQ endpoint", () => {
  it("401s without the token", async () => {
    expect((await getFaq(makeGet())).status).toBe(401);
  });

  it("returns only active entries as question/answer/category", async () => {
    const res = await getFaq(makeGet(TEST_TOKEN));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const mine = data.filter((f: { question: string }) => f.question.startsWith(TAG));
    expect(mine.map((f: { question: string }) => f.question)).toEqual([`${TAG}-active`]);
    expect(mine[0]).toMatchObject({ answer: "yes we do", category: "Facilities" });
  });
});
