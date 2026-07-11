import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";

// URL safety helpers, two concerns:
//   1. httpUrl — a Zod schema that only accepts http(s). Zod's .url() passes any
//      scheme the URL parser allows (incl. javascript:), and owner/staff-authored
//      links are rendered as clickable anchors, so restrict the scheme here.
//   2. assertPublicHttpUrl — a runtime guard for URLs we FETCH server-side (iCal
//      feeds). It resolves the host and refuses private/loopback/link-local
//      targets so a stored feed URL can't be used to reach internal services or a
//      cloud metadata endpoint (SSRF).

export function httpUrl(max = 1000) {
  return z
    .string()
    .url()
    .max(max)
    .refine((u) => {
      try {
        const p = new URL(u).protocol;
        return p === "http:" || p === "https:";
      } catch {
        return false;
      }
    }, "must be an http(s) URL");
}

// True for addresses that must never be the target of a server-side fetch:
// loopback, RFC-1918 private, link-local (incl. the 169.254.169.254 metadata
// endpoint), CGNAT, and their IPv6 equivalents.
function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fe80")) return true; // link-local
    if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique-local
    // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4 address.
    const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return false;
}

export class UnsafeUrlError extends Error {}

// Throw UnsafeUrlError unless `raw` is an http(s) URL whose host resolves only to
// public addresses. Resolving (not just string-matching the host) also blocks a
// domain that points at a private IP. Call this before any server-side fetch of a
// user-supplied URL.
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed.");
  }

  // URL.hostname keeps the brackets around an IPv6 literal ("[::1]"); strip them
  // so isIP recognises it instead of falling through to a DNS lookup.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A literal IP host: check it directly. A name: resolve every address it maps
  // to and reject if any is private (defends against a hostname → private IP).
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError("That address isn't allowed.");
  }
}
