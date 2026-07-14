import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { presignGetUrl, signRequest, uriEncode, type S3Credentials } from "@/lib/sigv4";

// SigV4 is a published, deterministic algorithm, so this suite checks our
// implementation against AWS's OWN documented example vectors rather than
// against itself. Both examples come from the S3 signing documentation and are
// the canonical reference values.
//
// The intermediate canonical-request hash is asserted as well as the final
// signature: if the signature is wrong, that tells us whether the canonical
// request was malformed (hash differs) or the key derivation was (hash matches,
// signature doesn't) — the difference between a five-minute fix and an
// afternoon.

// No secrets here — these are AWS's published example credentials, used in their
// docs precisely so implementations can verify against a known-good result.
const CREDS: S3Credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  host: "examplebucket.s3.amazonaws.com",
};

const AT = new Date("2013-05-24T00:00:00.000Z");

const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

describe("uriEncode", () => {
  it("leaves the unreserved set alone", () => {
    expect(uriEncode("abcXYZ019-._~", false)).toBe("abcXYZ019-._~");
  });

  it("encodes the characters encodeURIComponent misses", () => {
    // The whole reason this function exists instead of encodeURIComponent: these
    // would sign fine and then 403 on the wire.
    expect(uriEncode("!'()*", true)).toBe("%21%27%28%29%2A");
  });

  it("preserves / in paths but encodes it in query values", () => {
    expect(uriEncode("a/b", false)).toBe("a/b");
    expect(uriEncode("a/b", true)).toBe("a%2Fb");
  });

  it("encodes UTF-8 bytes, not code units", () => {
    expect(uriEncode("é", false)).toBe("%C3%A9");
  });
});

describe("presignGetUrl — AWS documented example (GET test.txt, 86400s)", () => {
  const url = presignGetUrl(CREDS, "test.txt", 86400, AT);

  it("builds the canonical request AWS documents", () => {
    // Reconstructed from the URL we produced, so this asserts what we actually
    // signed — not a restatement of the implementation.
    const q = url.slice(url.indexOf("?") + 1).replace(/&X-Amz-Signature=.*$/, "");
    const canonicalRequest = [
      "GET",
      "/test.txt",
      q,
      `host:${CREDS.host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    expect(sha256Hex(canonicalRequest)).toBe(
      "3bfa292879f6447bbcda7001decf97f4a54dc650c8942174ae0a9121cf58ad04",
    );
  });

  it("produces AWS's reference signature", () => {
    expect(url).toContain(
      "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("signs the credential scope and expiry into the query string", () => {
    expect(url).toContain("X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request");
    expect(url).toContain("X-Amz-Date=20130524T000000Z");
    expect(url).toContain("X-Amz-Expires=86400");
  });
});

describe("signRequest — AWS documented example (PUT test$file.text)", () => {
  const body = Buffer.from("Welcome to Amazon S3.");

  const headers = signRequest(
    CREDS,
    "PUT",
    "test$file.text",
    body,
    {
      date: "Fri, 24 May 2013 00:00:00 GMT",
      "x-amz-storage-class": "REDUCED_REDUNDANCY",
    },
    AT,
  );

  it("hashes the payload as AWS does", () => {
    expect(headers["x-amz-content-sha256"]).toBe(
      "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072",
    );
  });

  it("produces AWS's reference signature", () => {
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        "SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class, " +
        "Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
    );
  });

  it("does not return a host header — fetch sets it from the URL and rejects it here", () => {
    expect(headers).not.toHaveProperty("host");
  });
});

describe("signRequest — DELETE", () => {
  it("hashes an empty payload", () => {
    const headers = signRequest(CREDS, "DELETE", "abc/id-1.png", undefined, {}, AT);
    // sha256 of the empty string — the value S3 expects for a bodyless request.
    expect(headers["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(headers.authorization).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date");
  });
});
