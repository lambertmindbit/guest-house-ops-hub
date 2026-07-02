import { PrismaClient } from "@prisma/client";
import { tenantFromContext } from "@/lib/tenant";

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tenancy: `prisma` is a tenant-scoped client. A Prisma client extension
// injects the active property into every read/write on tenant-scoped models, so
// domain code never has to remember `where: { propertyId }`. PropertySettings is
// the tenant ROOT (no property_id) and is intentionally NOT scoped.
//
// Active tenant = the explicit AsyncLocalStorage context if set, else the SOLE
// property (single-property deployment). Ambiguous (0 or >1 properties and no
// context) → null → passthrough (unscoped) — correct for migrations/seeds/tests
// and an empty DB. Raw SQL ($queryRaw) is not intercepted; the one raw module
// (availability) is keyed on a tenant-owned roomTypeId, so it stays tenant-safe.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  basePrisma?: PrismaClient;
  prisma?: PrismaClient;
  solePropertyId?: string | null;
};

// Unextended base client — used for tenant resolution (avoids recursion).
const base = globalForPrisma.basePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.basePrisma = base;

const TENANT_MODELS = new Set<string>([
  "RoomType", "Room", "Channel", "Guest", "Reservation", "Payment", "Block", "Expense",
  "PricingPolicy", "Season", "RateOverride", "IcalFeed", "InboundBooking", "FlaggedNumber",
  "Escalation", "OutboundMessage", "Complaint", "Refund", "CancellationPolicy",
  "Staff", "Shift", "Attendance", "HousekeepingTask", "Asset", "MaintenanceRequest", "InventoryItem", "StockMovement", "Vendor", "PurchaseOrder", "VendorPayment", "Driver", "Trip", "BookingGroup",
]);

// Resolves the active property for the DEFAULT client: explicit context if set,
// else the sole property. Reading ALS from inside the extension is unreliable
// across the Prisma dispatch boundary, so per-tenant work uses prismaForTenant()
// (id closed over) rather than depending on this for isolation.
async function resolveDefaultPropertyId(): Promise<string | null> {
  const ctx = tenantFromContext();
  if (ctx) return ctx;
  if (globalForPrisma.solePropertyId !== undefined) return globalForPrisma.solePropertyId ?? null;
  const rows = await base.propertySettings.findMany({ select: { id: true }, take: 2 });
  globalForPrisma.solePropertyId = rows.length === 1 ? rows[0].id : null;
  return globalForPrisma.solePropertyId;
}

// Test/hook helper: clear the memoised sole-property id.
export function __resetTenantResolution() {
  globalForPrisma.solePropertyId = undefined;
}

type PidResolver = () => string | null | Promise<string | null>;

// Inject the resolved property into every read/write on tenant-scoped models.
function extendWith(resolve: PidResolver) {
  return (client: PrismaClient) =>
    client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) return query(args);
            const pid = await resolve();
            if (!pid) return query(args); // no tenant → passthrough
            const a = args as Record<string, unknown>;
            switch (operation) {
              case "findMany": case "findFirst": case "findFirstOrThrow":
              case "count": case "aggregate": case "groupBy":
              case "updateMany": case "deleteMany":
                a.where = { AND: [(a.where ?? {}) as object, { propertyId: pid }] };
                break;
              case "findUnique": case "findUniqueOrThrow":
              case "update": case "delete":
                // extendedWhereUnique (Prisma 5+): a unique field is already
                // present; propertyId is an additional filter.
                a.where = { ...(a.where as object), propertyId: pid };
                break;
              case "create":
                a.data = { propertyId: pid, ...(a.data as object) };
                break;
              case "createMany":
                a.data = Array.isArray(a.data)
                  ? (a.data as object[]).map((d) => ({ propertyId: pid, ...d }))
                  : { propertyId: pid, ...(a.data as object) };
                break;
              case "upsert":
                a.where = { ...(a.where as object), propertyId: pid };
                a.create = { propertyId: pid, ...(a.create as object) };
                break;
            }
            return query(a);
          },
        },
      },
    });
}

// A client hard-bound to one property — the reliable per-tenant path (no ALS).
// Used by tests today; slice (b) will bind one per request from the session.
export function prismaForTenant(propertyId: string): PrismaClient {
  return extendWith(() => propertyId)(base) as unknown as PrismaClient;
}

// The default app client: scopes to the sole property (single-property today).
export const prisma =
  globalForPrisma.prisma ?? (extendWith(resolveDefaultPropertyId)(base) as unknown as PrismaClient);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
