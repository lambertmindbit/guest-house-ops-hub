import { describe, it, expect } from "vitest";
import { isOverlapError, isUniqueViolation } from "@/lib/db-errors";

// The no-double-booking guarantee depends on classifying the exclusion-violation
// error correctly at the API boundary (→ friendly 409, not a raw 500). These
// pin the two shapes Prisma actually throws so a refactor can't silently break it.
describe("isOverlapError", () => {
  it("matches a structured SQLSTATE on meta.code (preferred path)", () => {
    expect(isOverlapError({ meta: { code: "23P01" } })).toBe(true);
  });

  it("matches an untyped create error that carries the code/name in its message", () => {
    expect(isOverlapError(new Error('... conflicting key value violates exclusion constraint "no_overlapping_confirmed_stays"'))).toBe(true);
    expect(isOverlapError({ message: "db error: 23P01 exclusion_violation" })).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isOverlapError(new Error("connection refused"))).toBe(false);
    expect(isOverlapError({ meta: { code: "23505" } })).toBe(false);
    expect(isOverlapError(null)).toBe(false);
    expect(isOverlapError("nope")).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("matches Prisma P2002 and Postgres 23505", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ message: "duplicate key value violates unique constraint (23505)" })).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
