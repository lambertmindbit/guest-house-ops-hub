import { describe, it, expect } from "vitest";
import { hasIdOnFile, isForeignGuest, checkInBlockReason, type GuestIdFields } from "@/lib/id-gate";

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
