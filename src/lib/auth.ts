// Single-owner auth with zero dependencies. A session is a signed token
// (payload.signature) stored in an httpOnly cookie. We sign/verify with Web
// Crypto (crypto.subtle) so the SAME code runs in both the Edge middleware and
// Node route handlers. Credentials live in .env (OWNER_EMAIL/OWNER_PASSWORD);
// the cookie is signed with AUTH_SECRET.

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

export async function createSessionToken(email: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: email, exp: Date.now() + MAX_AGE_MS })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromBase64Url(signature),
    encoder.encode(payload),
  );
  if (!valid) return false;

  try {
    const { exp } = JSON.parse(decoder.decode(fromBase64Url(payload)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
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
