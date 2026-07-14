// AWS Signature V4, the subset S3-compatible object storage needs (DigitalOcean
// Spaces). Deliberately no SDK: the storage adapter this backs is four fetch
// calls, and pulling several MB of AWS SDK in to sign them would be a bad trade
// — the Supabase adapter it replaces made the same call.
//
// SigV4 is a fixed, published algorithm, so "it seemed to work" is not the bar:
// tests/sigv4.test.ts checks this against AWS's own documented example vectors,
// including the intermediate canonical-request hash, so a wrong signature is
// caught at the step that produced it.

import { createHash, createHmac } from "node:crypto";

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Virtual-hosted-style bucket host, e.g. `guest-ids.blr1.digitaloceanspaces.com`. */
  host: string;
}

const sha256Hex = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac("sha256", key).update(data, "utf8").digest();

/**
 * Percent-encode per RFC 3986, which is what AWS canonical requests require.
 *
 * `encodeURIComponent` is NOT a substitute: it leaves !'()* unencoded, and AWS
 * expects them encoded — a key containing any of them would sign correctly and
 * then 403 on the wire. Encodes UTF-8 bytes, not code units, so non-ASCII keys
 * are handled.
 */
export function uriEncode(input: string, encodeSlash: boolean): string {
  let out = "";
  for (const byte of Buffer.from(input, "utf8")) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === "/" && !encodeSlash) out += "/";
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

/** `20130524T000000Z` and its `20130524` date half. */
function stamps(now: Date): { amzDate: string; date: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, date: amzDate.slice(0, 8) };
}

function sign(creds: S3Credentials, amzDate: string, date: string, canonicalRequest: string): string {
  const scope = `${date}/${creds.region}/${SERVICE}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  return hmac(signingKey(creds.secretAccessKey, date, creds.region), stringToSign).toString("hex");
}

/**
 * A short-lived GET URL for a private object. The signature lives in the query
 * string, so the URL can be handed straight to an <img> or a download link.
 */
export function presignGetUrl(
  creds: S3Credentials,
  key: string,
  expiresInSec: number,
  now: Date = new Date(),
): string {
  const { amzDate, date } = stamps(now);
  const canonicalUri = `/${uriEncode(key, false)}`;

  // Canonical query: every key and value encoded, then sorted by encoded key.
  const canonicalQuery = (
    [
      ["X-Amz-Algorithm", ALGORITHM],
      ["X-Amz-Credential", `${creds.accessKeyId}/${date}/${creds.region}/${SERVICE}/aws4_request`],
      ["X-Amz-Date", amzDate],
      ["X-Amz-Expires", String(expiresInSec)],
      ["X-Amz-SignedHeaders", "host"],
    ] as const
  )
    .map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(v, true)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${creds.host}\n`, // canonical headers block ends with its own newline…
    "host", // …and join() supplies the blank line that must follow it
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const signature = sign(creds, amzDate, date, canonicalRequest);
  return `https://${creds.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Headers for an authenticated request, ready to hand to `fetch`.
 *
 * `host` is signed but deliberately not returned: fetch derives it from the URL
 * and forbids setting it explicitly.
 */
export function signRequest(
  creds: S3Credentials,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  body?: Buffer,
  extraHeaders: Record<string, string> = {},
  now: Date = new Date(),
): Record<string, string> {
  const { amzDate, date } = stamps(now);
  const payloadHash = sha256Hex(body ?? "");

  const headers: Record<string, string> = {
    host: creds.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(extraHeaders)) headers[k.toLowerCase()] = v;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method,
    `/${uriEncode(key, false)}`,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const signature = sign(creds, amzDate, date, canonicalRequest);
  const scope = `${date}/${creds.region}/${SERVICE}/aws4_request`;

  const sendable = { ...headers };
  delete sendable.host;

  return {
    ...sendable,
    authorization: `${ALGORITHM} Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
