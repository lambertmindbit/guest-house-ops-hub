import { describe, it, expect } from "vitest";
import {
  guestRegistrationRows,
  cformRows,
  isForeignNational,
  idComplianceRows,
} from "@/lib/registration";

const get = (rows: { label: string; value: string }[], label: string) =>
  rows.find((r) => r.label === label)?.value;

describe("registration rows", () => {
  it("maps core fields, dashes empty values, joins preferences + emergency contact", () => {
    const rows = guestRegistrationRows({
      name: "Ibaphinri",
      phone: "9990001111",
      email: "",
      address: "Mawlai, Shillong",
      vehicleNumber: "ML05 1234",
      idNumber: "AADH-1",
      emergencyContactName: "Kong",
      emergencyContactPhone: "8880002222",
      preferences: ["ground floor", "no pets"],
    });
    expect(get(rows, "Address")).toBe("Mawlai, Shillong");
    expect(get(rows, "Email")).toBe("—");
    expect(get(rows, "Vehicle number")).toBe("ML05 1234");
    expect(get(rows, "Emergency contact")).toBe("Kong · 8880002222");
    expect(get(rows, "Preferences")).toBe("ground floor, no pets");
  });

  it("falls back to a single emergency value when only one is present", () => {
    const rows = guestRegistrationRows({ name: "x", phone: "1", emergencyContactPhone: "777" });
    expect(get(rows, "Emergency contact")).toBe("777");
  });

  it("detects a foreign national by nationality and lists C-Form values", () => {
    expect(isForeignNational({ name: "x", phone: "1" })).toBe(false);
    expect(isForeignNational({ name: "x", phone: "1", nationality: "French" })).toBe(true);
    expect(get(cformRows({ name: "x", phone: "1", passportNumber: "AB1" }), "Passport no.")).toBe("AB1");
  });

  it("reflects the ID compliance flags", () => {
    const rows = idComplianceRows({ name: "x", phone: "1", idChecked: true, idUploaded: true });
    expect(rows.find((r) => r.label === "ID checked")?.done).toBe(true);
    expect(rows.find((r) => r.label === "ID uploaded")?.done).toBe(true);
    expect(rows.find((r) => r.label === "Verification completed")?.done).toBe(false);
  });
});
