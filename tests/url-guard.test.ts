import { describe, it, expect } from "vitest";
import { httpUrl, assertPublicHttpUrl, UnsafeUrlError } from "@/lib/url-guard";

describe("httpUrl (SEC-4: scheme allow-list)", () => {
  const schema = httpUrl();

  it("accepts http and https", () => {
    expect(schema.safeParse("https://example.com/a.jpg").success).toBe(true);
    expect(schema.safeParse("http://example.com").success).toBe(true);
  });

  it("rejects javascript: and other non-http schemes", () => {
    expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(schema.safeParse("data:text/html,<script>1</script>").success).toBe(false);
    expect(schema.safeParse("file:///etc/passwd").success).toBe(false);
    expect(schema.safeParse("not a url").success).toBe(false);
  });
});

describe("assertPublicHttpUrl (SEC-2: SSRF guard)", () => {
  it("rejects loopback, private, link-local, and CGNAT IP literals", async () => {
    for (const raw of [
      "http://127.0.0.1/feed.ics",
      "http://169.254.169.254/latest/meta-data/", // cloud metadata
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.16.0.1/x",
      "http://100.64.0.1/x",
      "http://[::1]/x",
    ]) {
      await expect(assertPublicHttpUrl(raw)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicHttpUrl("ftp://8.8.8.8/x")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("allows a public IP literal", async () => {
    await expect(assertPublicHttpUrl("https://8.8.8.8/feed.ics")).resolves.toBeUndefined();
  });
});
