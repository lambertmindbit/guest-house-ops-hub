import { describe, it, expect } from "vitest";
import { STARTER_FAQS } from "@/lib/faq-starter";
import { bestFaqMatch } from "@/lib/assistant/stub";

describe("STARTER_FAQS pack", () => {
  it("is a healthy, well-formed set", () => {
    expect(STARTER_FAQS.length).toBeGreaterThanOrEqual(30);
    for (const f of STARTER_FAQS) {
      expect(f.question.trim().length).toBeGreaterThan(0);
      expect(f.answer.trim().length).toBeGreaterThan(0);
      expect(f.category.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate questions", () => {
    const seen = new Set(STARTER_FAQS.map((f) => f.question.trim().toLowerCase()));
    expect(seen.size).toBe(STARTER_FAQS.length);
  });

  it("covers the topics guests actually ask about", () => {
    const blob = STARTER_FAQS.map((f) => `${f.question} ${f.category}`.toLowerCase()).join(" | ");
    for (const topic of ["pool", "air conditioning", "hot water", "location", "airport", "payment", "children", "smoking", "cancellation"]) {
      expect(blob).toContain(topic);
    }
  });
});

describe("bestFaqMatch (fallback FAQ matching)", () => {
  const faqs = STARTER_FAQS;

  it("answers 'is there a pool?' from the pool entry", () => {
    const a = bestFaqMatch("is there a pool?", faqs);
    expect(a).toBe(STARTER_FAQS.find((f) => f.question.includes("swimming pool"))!.answer);
  });

  it("matches on a keyword regardless of phrasing", () => {
    expect(bestFaqMatch("do you have aircon / air conditioning", faqs)).toContain("air conditioning");
    expect(bestFaqMatch("how far is the airport", faqs)).toBeTruthy();
  });

  it("returns null when nothing meaningfully overlaps", () => {
    expect(bestFaqMatch("hello", faqs)).toBeNull();
    expect(bestFaqMatch("", faqs)).toBeNull();
  });
});
