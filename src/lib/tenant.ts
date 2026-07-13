import { AsyncLocalStorage } from "node:async_hooks";

// Request-scoped tenant context. Server code establishes the active property once
// (from the session, later); the Prisma tenant extension (src/lib/prisma.ts) then
// scopes every read/write to it — the "one line in the query layer".
//
// Single-property today: when no context is set, the extension falls back to the
// sole property, so existing pages/routes work without threading a tenant through.

type TenantCtx = { propertyId: string };

const als = new AsyncLocalStorage<TenantCtx>();

// Run `fn` with an explicit active property. Everything queried through `prisma`
// inside the callback is scoped to `propertyId`.
export function withTenant<T>(propertyId: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ propertyId }, fn);
}

export function tenantFromContext(): string | null {
  return als.getStore()?.propertyId ?? null;
}

// The acting property for hand-written raw SQL (which the Prisma tenant extension
// can't rewrite): an explicit id if the caller has one, else the ALS context, else
// the request header the middleware stamps. Null when none apply (scripts/tests) →
// callers leave the query unscoped, matching the extension's passthrough. Mirrors
// the resolution order in prisma.ts so raw SQL scopes the same way as the ORM.
export async function requestPropertyId(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const ctx = tenantFromContext();
  if (ctx) return ctx;
  try {
    const { headers } = await import("next/headers");
    const value = (await headers()).get("x-ota-tenant");
    return value && value.length > 0 ? value : null;
  } catch {
    return null; // not in a request context
  }
}
