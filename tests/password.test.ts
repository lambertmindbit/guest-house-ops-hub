import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password (scrypt)", () => {
  it("verifies the correct password and rejects a wrong one", () => {
    const h = hashPassword("s3cret-pass");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("s3cret-pass", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("uses a fresh salt per hash", () => {
    expect(hashPassword("x")).not.toBe(hashPassword("x"));
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
