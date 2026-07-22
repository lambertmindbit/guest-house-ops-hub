import { unscopedPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Row-Level Security backstop (GAP-12, DB layer). Run a block of queries with DB-
// enforced tenant isolation — even a raw `SELECT * FROM reservations` with no WHERE
// returns only this property's rows.
//
// How, and why it has to be this way:
//   • The app connects as `postgres`, which has BYPASSRLS, so RLS never applies on
//     the normal path. That's deliberate — it's what makes enabling RLS a no-op for
//     all existing traffic. Enforcement is reached only by switching into a
//     non-bypass role. We use Supabase's built-in `authenticated` (a custom role
//     can't be used: Supabase forbids granting role membership to `postgres`, and
//     `postgres` already can SET ROLE into `authenticated`).
//   • Runtime goes through Supabase's TRANSACTION pooler, where connections are
//     reused across requests. A session-level `SET` would leak one tenant's context
//     into the next request. `SET LOCAL` (and `SET LOCAL ROLE`) are transaction-
//     scoped and die on commit/rollback, so they're the only safe primitives here —
//     hence the interactive transaction.
//
// This is a contained backstop: it hardens code that opts in (raw SQL that would
// otherwise rely on hand-written scoping). It does not change the pooled app path,
// where the Prisma tenant extension remains the primary isolation.
export function withRlsTenant<T>(
  propertyId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return unscopedPrisma.$transaction(async (tx) => {
    // Become the non-bypass role for this transaction, then bind the tenant. Order
    // matters: the role switch first, so the query below is subject to RLS.
    await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
    // Parameterised (never string-built) so the property id can't inject SQL.
    await tx.$executeRaw`SELECT set_config('app.property_id', ${propertyId}, true)`;
    return fn(tx);
  });
}
