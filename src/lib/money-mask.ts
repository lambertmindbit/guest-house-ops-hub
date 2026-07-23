import { canSeeMoney, type Role } from "@/lib/authz";

// Field-level money masking (GAP-12, app-layer). RBAC gates PAGES; this strips the
// money FIELDS from API payloads so a non-owner role can't read amounts by calling
// an endpoint directly (the SEC-1 leak class). Owners are unaffected. Pure — the
// database is never touched (no RLS in this pass).

// Money fields that can appear on a reservation payload. nightlyRates (GAP-22) is a
// per-night rate breakdown — also money, so non-owners must not see it either.
const RESERVATION_MONEY_FIELDS = ["grossAmount", "advanceRequired", "nightlyRates"] as const;

export function maskReservationMoney<T extends Record<string, unknown>>(role: Role, reservation: T): T {
  if (canSeeMoney(role)) return reservation;
  const out: Record<string, unknown> = { ...reservation };
  for (const f of RESERVATION_MONEY_FIELDS) if (f in out) out[f] = null;
  // Any nested payments carry an `amount` — null those too.
  if (Array.isArray(out.payments)) {
    out.payments = (out.payments as Record<string, unknown>[]).map((p) => ({ ...p, amount: null }));
  }
  return out as T;
}

export function maskReservationsMoney<T extends Record<string, unknown>>(role: Role, reservations: T[]): T[] {
  if (canSeeMoney(role)) return reservations;
  return reservations.map((r) => maskReservationMoney(role, r));
}
