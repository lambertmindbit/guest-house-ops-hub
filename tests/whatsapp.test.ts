import { describe, it, expect, vi, afterEach } from "vitest";
import {
  whatsappConfigFromEnv,
  normalizeE164,
  buildTextMessage,
  adapterFromEnv,
  whatsappAdapter,
} from "@/lib/whatsapp";

describe("whatsappConfigFromEnv", () => {
  it("is null unless explicitly enabled AND credentialed", () => {
    expect(whatsappConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    // Credentials present but the flag off — still null (no accidental sends).
    expect(whatsappConfigFromEnv({ WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    // Flag on but a credential missing — null.
    expect(whatsappConfigFromEnv({ WHATSAPP_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
  it("returns config with a default api version when fully set", () => {
    const cfg = whatsappConfigFromEnv({ WHATSAPP_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "123" } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ token: "tok", phoneNumberId: "123", apiVersion: "v21.0" });
  });
});

describe("normalizeE164", () => {
  it("assumes +91 for a bare 10-digit Indian mobile", () => {
    expect(normalizeE164("9863000001")).toBe("919863000001");
  });
  it("respects an existing country code, '+', or leading 0", () => {
    expect(normalizeE164("+91 98630 00001")).toBe("919863000001");
    expect(normalizeE164("09863000001")).toBe("919863000001");
    expect(normalizeE164("919863000001")).toBe("919863000001");
  });
});

describe("buildTextMessage", () => {
  it("shapes a Graph API text payload with a normalised recipient", () => {
    const p = buildTextMessage("9863000001", "Hi there");
    expect(p).toMatchObject({ messaging_product: "whatsapp", to: "919863000001", type: "text", text: { body: "Hi there" } });
  });
});

describe("adapterFromEnv", () => {
  it("is null when WhatsApp isn't switched on", () => {
    expect(adapterFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });
  it("returns the cloud adapter when configured", () => {
    const a = adapterFromEnv({ WHATSAPP_ENABLED: "true", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" } as unknown as NodeJS.ProcessEnv);
    expect(a?.name).toBe("whatsapp-cloud");
  });
});

describe("whatsappAdapter.send (status mapping)", () => {
  const adapter = whatsappAdapter({ token: "t", phoneNumberId: "1", apiVersion: "v21.0" });
  afterEach(() => vi.unstubAllGlobals());

  it("maps a 200 to sent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const r = await adapter.send({ channel: "whatsapp", to: "9863000001", body: "hi" });
    expect(r.status).toBe("sent");
    expect(r.sentAt).toBeInstanceOf(Date);
  });
  it("maps a non-2xx to failed with the error detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad token", { status: 401 })));
    const r = await adapter.send({ channel: "whatsapp", to: "9863000001", body: "hi" });
    expect(r.status).toBe("failed");
    expect(r.error).toContain("401");
  });
  it("a network throw becomes failed, never an unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    const r = await adapter.send({ channel: "whatsapp", to: "9863000001", body: "hi" });
    expect(r.status).toBe("failed");
  });
  it("leaves non-WhatsApp channels to the log path (doesn't call the API)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await adapter.send({ channel: "email", to: "a@b.com", body: "hi" });
    expect(r.status).toBe("logged");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
