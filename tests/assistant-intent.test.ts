import { describe, it, expect } from "vitest";
import { parseIntent } from "@/lib/assistant/intent";
import { buildTurn } from "@/lib/assistant/stub";

describe("parseIntent (pure)", () => {
  it("recognises greetings only when short", () => {
    expect(parseIntent("hi").kind).toBe("greeting");
    expect(parseIntent("Namaste!").kind).toBe("greeting");
    // A long message that merely starts with a greeting word is not a greeting.
    expect(parseIntent("hello, what rooms are free 2026-08-01 to 2026-08-03").kind).toBe("availability");
  });

  it("pulls the two dates out of an availability question", () => {
    const i = parseIntent("what rooms are free 2026-08-01 to 2026-08-03?");
    expect(i).toMatchObject({ kind: "availability", checkIn: "2026-08-01", checkOut: "2026-08-03" });
  });

  it("routes price/book/help keywords", () => {
    expect(parseIntent("how much is a room?").kind).toBe("quote");
    expect(parseIntent("I want to book").kind).toBe("book");
    expect(parseIntent("what can you do").kind).toBe("help");
    expect(parseIntent("tell me a joke").kind).toBe("fallback");
  });

  it("parses slash-commands from card actions exactly", () => {
    expect(parseIntent("/quote room_1 2026-08-01 2026-08-03")).toEqual({ kind: "quote", roomId: "room_1", checkIn: "2026-08-01", checkOut: "2026-08-03" });
    expect(parseIntent("/book room_9 2026-08-01 2026-08-03")).toEqual({ kind: "book", roomId: "room_9", checkIn: "2026-08-01", checkOut: "2026-08-03" });
    expect(parseIntent("/confirm room_9 2026-08-01 2026-08-03").kind).toBe("confirm");
  });
});

describe("buildTurn (no-DB paths)", () => {
  it("greeting/help/fallback return text then done, never touching data", async () => {
    for (const msg of ["hi", "help", "tell me a joke"]) {
      const chunks = await buildTurn(msg);
      expect(chunks[0].type).toBe("text");
      expect(chunks[chunks.length - 1]).toEqual({ type: "done" });
      expect(chunks.some((c) => c.type === "ui")).toBe(false);
    }
  });

  it("confirm is a demo acknowledgement — no booking write in Phase 1", async () => {
    const chunks = await buildTurn("/confirm room_1 2026-08-01 2026-08-03");
    const text = chunks.filter((c) => c.type === "text").map((c) => (c as { delta: string }).delta).join(" ");
    expect(text.toLowerCase()).toContain("doesn't save a booking");
  });

  it("availability without dates asks for them (no data call)", async () => {
    const chunks = await buildTurn("what rooms are free?");
    expect(chunks.some((c) => c.type === "ui")).toBe(false);
    expect(chunks[0].type).toBe("text");
  });
});
