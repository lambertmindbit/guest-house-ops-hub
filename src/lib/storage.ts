// Thin Supabase Storage adapter over the REST API — no SDK dependency. Used for
// scanned guest ID documents. Storage is OPTIONAL: if the env isn't set, the app
// runs fine and the upload UI shows a "not configured" hint.
//
// To enable: create a PRIVATE bucket in Supabase Storage (default name
// "guest-ids") and set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (and optionally
// SUPABASE_ID_BUCKET). The service-role key is server-only — never exposed to the
// client; all access goes through the API routes below.

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_ID_BUCKET || "guest-ids";

export function isStorageConfigured(): boolean {
  return Boolean(BASE && KEY);
}

function authHeaders(extra?: Record<string, string>) {
  return { Authorization: `Bearer ${KEY}`, apikey: KEY as string, ...extra };
}

export async function uploadObject(path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: "POST",
    headers: authHeaders({ "content-type": contentType, "x-upsert": "true" }),
    body,
  });
  if (!res.ok) throw new Error(`storage upload failed (${res.status}): ${await res.text()}`);
}

// Private buckets need a short-lived signed URL to view an object.
export async function signedUrl(path: string, expiresInSec = 3600): Promise<string> {
  const res = await fetch(`${BASE}/storage/v1/object/sign/${BUCKET}/${encodeURI(path)}`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ expiresIn: expiresInSec }),
  });
  if (!res.ok) throw new Error(`storage sign failed (${res.status})`);
  const json = (await res.json()) as { signedURL: string };
  return `${BASE}/storage/v1${json.signedURL}`;
}

export async function deleteObject(path: string): Promise<void> {
  await fetch(`${BASE}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
