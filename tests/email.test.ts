import { describe, it, expect, vi } from "vitest";
import { smtpConfigFromEnv, sendEmail } from "@/lib/email";

describe("smtpConfigFromEnv", () => {
  it("is null unless SMTP_HOST is set (so email is off by default)", () => {
    expect(smtpConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });
  it("fills sensible defaults when configured", () => {
    const c = smtpConfigFromEnv({ SMTP_HOST: "smtp.example", SMTP_USER: "u@example" } as unknown as NodeJS.ProcessEnv);
    expect(c).toMatchObject({ host: "smtp.example", port: 587, user: "u@example", from: "u@example" });
  });
});

describe("sendEmail (log-only when unconfigured)", () => {
  it("logs the message, reports not delivered, and never throws", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await sendEmail({ to: "a@b.test", subject: "Hi", text: "the link" }, {} as NodeJS.ProcessEnv);
    expect(r.delivered).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
