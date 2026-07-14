// Thin S3-compatible object-storage adapter over the REST API — no SDK
// dependency. Used for scanned guest ID documents. Storage is OPTIONAL: if the
// env isn't set, the app runs fine and the upload UI shows a "not configured"
// hint.
//
// This is the DigitalOcean Spaces version of the adapter. On `main` the same
// four exports are backed by Supabase Storage; the interface is identical, so
// nothing that imports this file changes. Requests are signed with AWS SigV4
// (see ./sigv4), which Spaces speaks.
//
// To enable: create a PRIVATE Spaces bucket, generate a Spaces access key
// (API → Spaces Keys), and set SPACES_KEY + SPACES_SECRET (and optionally
// SPACES_REGION / SPACES_BUCKET). The secret is server-only — never exposed to
// the client; all access goes through the API routes.

import { presignGetUrl, signRequest, uriEncode, type S3Credentials } from "./sigv4";

const KEY = process.env.SPACES_KEY;
const SECRET = process.env.SPACES_SECRET;
const REGION = process.env.SPACES_REGION || "blr1";
const BUCKET = process.env.SPACES_BUCKET || "guest-ids";
const ENDPOINT = process.env.SPACES_ENDPOINT || `${REGION}.digitaloceanspaces.com`;

export function isStorageConfigured(): boolean {
  return Boolean(KEY && SECRET);
}

function creds(): S3Credentials {
  // Callers gate on isStorageConfigured(); this is the backstop that keeps a
  // missing key from being signed as the literal string "undefined".
  if (!KEY || !SECRET) throw new Error("Object storage is not configured (SPACES_KEY / SPACES_SECRET).");
  return { accessKeyId: KEY, secretAccessKey: SECRET, region: REGION, host: `${BUCKET}.${ENDPOINT}` };
}

// The request URL must be encoded exactly the way it was signed, or the
// signature covers a different path than the one on the wire and Spaces 403s.
const objectUrl = (c: S3Credentials, path: string) => `https://${c.host}/${uriEncode(path, false)}`;

export async function uploadObject(path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const c = creds();
  const buf = Buffer.from(body);
  const headers = signRequest(c, "PUT", path, buf, { "content-type": contentType });
  const res = await fetch(objectUrl(c, path), { method: "PUT", headers, body: buf });
  if (!res.ok) throw new Error(`storage upload failed (${res.status}): ${await res.text()}`);
}

// Private buckets need a short-lived signed URL to view an object.
export async function signedUrl(path: string, expiresInSec = 3600): Promise<string> {
  // Presigning is pure computation — no round trip — but the signature stays
  // async to match the interface every caller already awaits.
  return presignGetUrl(creds(), path, expiresInSec);
}

export async function deleteObject(path: string): Promise<void> {
  const c = creds();
  const headers = signRequest(c, "DELETE", path);
  await fetch(objectUrl(c, path), { method: "DELETE", headers });
}
