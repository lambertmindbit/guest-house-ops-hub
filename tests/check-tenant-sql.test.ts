import { describe, it, expect } from "vitest";
// The CI guard's logic is a pure module; the CLI half is import.meta-guarded.
import { scanSource, tenantTablesFromSchema } from "../scripts/check-tenant-sql.mjs";

const tenantTables = new Set(["reservations", "rooms", "payments"]);

describe("tenant-sql scan (US-606)", () => {
  it("flags a raw query over a tenant table with no property_id", () => {
    const bad = "await prisma.$queryRaw`SELECT * FROM reservations WHERE status = 'confirmed'`;";
    expect(scanSource(bad, tenantTables).length).toBe(1);
  });

  it("passes a query that scopes property_id", () => {
    const good = "await prisma.$queryRaw`SELECT * FROM reservations r WHERE r.property_id = ${pid}`;";
    expect(scanSource(good, tenantTables)).toEqual([]);
  });

  it("passes a query with an explicit tenant-sql-ok opt-out", () => {
    const optout = "await prisma.$queryRaw`SELECT count(*) FROM reservations /* tenant-sql-ok: global metric */`;";
    expect(scanSource(optout, tenantTables)).toEqual([]);
  });

  it("ignores raw queries that touch no tenant table", () => {
    const nontenant = "await prisma.$queryRaw`SELECT 1 FROM network_connections`;";
    expect(scanSource(nontenant, tenantTables)).toEqual([]);
  });

  it("derives tenant tables from the schema @@map of TENANT_MODELS only", () => {
    const prismaLib = 'const TENANT_MODELS = new Set<string>(["Room", "Reservation"]);';
    const schema = [
      'model Room {\n id String\n @@map("rooms")\n}',
      'model Reservation {\n id String\n @@map("reservations")\n}',
      'model Guest {\n id String\n @@map("guests")\n}',
    ].join("\n");
    const t = tenantTablesFromSchema(schema, prismaLib);
    expect(t.has("rooms")).toBe(true);
    expect(t.has("reservations")).toBe(true);
    expect(t.has("guests")).toBe(false); // Guest is shared owner-wide, not tenant-scoped
  });
});
