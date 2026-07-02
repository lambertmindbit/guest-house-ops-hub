import { describe, it, expect } from "vitest";
import { hasIdOnFile, isForeignGuest, checkInBlockReason, checkInGate, normalizeIdPolicy, type GuestIdFields } from "@/lib/id-gate";

const base: GuestIdFields = {
  idNumber: null, idUploaded: false, idChecked: false, idVerificationCompleted: false,
  nationality: null, passportNumber: null,
};

describe("hasIdOnFile", () => {
  it("is false with nothing recorded", () => {
    expect(hasIdOnFile(base)).toBe(false);
  });
  it("is true on any concrete evidence", () => {
    expect(hasIdOnFile({ ...base, idNumber: "AADHAAR-123" })).toBe(true);
    expect(hasIdOnFile({ ...base, idUploaded: true })).toBe(true);
    expect(hasIdOnFile({ ...base, idChecked: true })).toBe(true);
    expect(hasIdOnFile({ ...base, idVerificationCompleted: true })).toBe(true);
    expect(hasIdOnFile({ ...base, passportNumber: "P1234567" })).toBe(true);
  });
  it("ignores blank strings", () => {
    expect(hasIdOnFile({ ...base, idNumber: "   " })).toBe(false);
  });
});

describe("checkInBlockReason", () => {
  it("blocks a domestic guest with no ID, allows once recorded", () => {
    expect(checkInBlockReason(base)).toMatch(/government ID/i);
    expect(checkInBlockReason({ ...base, idNumber: "AADHAAR-123" })).toBeNull();
  });

  it("requires the C-Form (passport) for a foreign guest", () => {
    expect(isForeignGuest({ ...base, nationality: "French" })).toBe(true);
    // Foreign, ID number present but no passport → still blocked for the C-Form.
    expect(checkInBlockReason({ ...base, nationality: "French", idNumber: "X1" })).toMatch(/C-Form/i);
    // Foreign with passport → allowed.
    expect(checkInBlockReason({ ...base, nationality: "French", passportNumber: "P1234567" })).toBeNull();
  });
});

describe("normalizeIdPolicy", () => {
  it("defaults anything unknown to block", () => {
    expect(normalizeIdPolicy("off")).toBe("off");
    expect(normalizeIdPolicy("warn")).toBe("warn");
    expect(normalizeIdPolicy("block")).toBe("block");
    expect(normalizeIdPolicy(null)).toBe("block");
    expect(normalizeIdPolicy("nonsense")).toBe("block");
  });
});

describe("checkInGate (policy)", () => {
  const noId = base;
  it("block: refuses when ID missing, allows when present", () => {
    expect(checkInGate("block", noId)).toEqual({ blocked: true, reason: expect.stringMatching(/government ID/i) });
    expect(checkInGate("block", { ...base, idNumber: "X" })).toEqual({ blocked: false, reason: null });
  });
  it("warn: never blocks, but still reports the reason", () => {
    const g = checkInGate("warn", noId);
    expect(g.blocked).toBe(false);
    expect(g.reason).toMatch(/government ID/i);
  });
  it("off: no gate at all", () => {
    expect(checkInGate("off", noId)).toEqual({ blocked: false, reason: null });
  });
});
