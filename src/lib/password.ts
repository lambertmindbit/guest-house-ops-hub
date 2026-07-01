import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Password hashing with Node's built-in scrypt — no dependency. Format:
// `scrypt$<saltHex>$<hashHex>`. Node-only (uses node:crypto); never import this
// from the Edge middleware.

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
