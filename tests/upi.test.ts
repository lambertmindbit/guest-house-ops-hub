import { describe, it, expect } from "vitest";
import { isValidVpa, buildUpiLink } from "@/lib/upi";

describe("isValidVpa", () => {
  it("accepts handle@bank forms", () => {
    expect(isValidVpa("lawei@okhdfcbank")).toBe(true);
    expect(isValidVpa("ibaphinri.phanwar@ybl")).toBe(true);
  });
  it("rejects malformed VPAs", () => {
    expect(isValidVpa("nobank")).toBe(false);
    expect(isValidVpa("@ybl")).toBe(false);
    expect(isValidVpa("lawei@")).toBe(false);
    expect(isValidVpa("lawei@1")).toBe(false); // handle must start alpha
  });
});

describe("buildUpiLink", () => {
  it("builds a upi://pay link with encoded payee + amount + note", () => {
    const link = buildUpiLink({ vpa: "lawei@okhdfcbank", payeeName: "Lawei Homestay", amount: 2000, note: "Advance for booking" });
    expect(link.startsWith("upi://pay?")).toBe(true);
    expect(link).toContain("pa=lawei%40okhdfcbank");
    expect(link).toContain("pn=Lawei%20Homestay");
    expect(link).toContain("am=2000.00");
    expect(link).toContain("cu=INR");
    expect(link).toContain("tn=Advance%20for%20booking");
  });

  it("omits the amount when zero/undefined so the guest can enter it", () => {
    expect(buildUpiLink({ vpa: "a@b", payeeName: "X", amount: 0 })).not.toContain("am=");
    expect(buildUpiLink({ vpa: "a@b", payeeName: "X" })).not.toContain("am=");
  });
});
