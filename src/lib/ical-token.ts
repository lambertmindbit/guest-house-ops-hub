import { createHmac, timingSafeEqual } from "node:crypto";

// Per-room export token. Each room's feed URL carries a token derived from the
// room id and the ICAL_FEED_TOKEN secret — so a single leaked link only exposes
// that one room, not every room (and can't be forged without the secret). No DB
// state: the token is recomputable from the room id alone. Node-only (this is
// used by the Node iCal route + the Server-Component settings page, never Edge).
export function icalTokenForRoom(roomId: string): string {
  const secret = process.env.ICAL_FEED_TOKEN ?? "";
  return createHmac("sha256", secret).update(roomId).digest("base64url");
}

export function icalTokenValid(roomId: string, token: string): boolean {
  if (!process.env.ICAL_FEED_TOKEN) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(icalTokenForRoom(roomId));
  return a.length === b.length && timingSafeEqual(a, b);
}
