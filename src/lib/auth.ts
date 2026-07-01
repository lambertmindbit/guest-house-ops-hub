// Single-owner auth with zero dependencies. A session is a signed token
// (payload.signature) stored in an httpOnly cookie. We sign/verify with Web
// Crypto (crypto.subtle) so the SAME code runs in both the Edge middleware and
// Node route handlers. Credentials live in .env (OWNER_EMAIL/OWNER_PASSWORD);
// the cookie is signed with AUTH_SECRET.

import type { Role } from "@/lib/authz";

export const SESSION_COOKIE = "ota_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Signed session claims. role/propertyId ride in the token so the Edge
// middleware can gate by role with no DB lookup (tamper-proof via the HMAC).
export type SessionClaims = { sub: string; role: Role; propertyId: string | null };

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ ...claims, exp: Date.now() + MAX_AGE_MS })),
  );
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

// Verify signature + expiry, return claims or null. Legacy tokens (pre-roles)
// carried only { sub, exp } — those were the single owner, so default owner.
export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromBase64Url(signature),
    encoder.encode(payload),
  );
  if (!valid) return null;

  try {
    const data = JSON.parse(decoder.decode(fromBase64Url(payload)));
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return {
      sub: String(data.sub ?? ""),
      role: (data.role as Role) ?? "owner",
      propertyId: data.propertyId ?? null,
    };
  } catch {
    return null;
  }
}

// Boolean gate kept for callers that only need validity.
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}

// Constant-time string comparison to avoid leaking length/contents via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyCredentials(email: string, password: string): boolean {
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  const ownerPassword = process.env.OWNER_PASSWORD ?? "";
  return safeEqual(email, ownerEmail) && safeEqual(password, ownerPassword);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_MS / 1000,
};
