import { unscopedPrisma } from "@/lib/prisma";

// Health check for external uptime monitoring (GAP-17). Unauthenticated and reveals
// nothing sensitive — just whether the app is up and can reach its database. Point an
// uptime monitor (UptimeRobot / Better Uptime / a cron) at /api/health per deployment
// and alert on a non-200. 200 = healthy, 503 = the DB is unreachable.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let db = false;
  try {
    await unscopedPrisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const body = {
    status: db ? "ok" : "degraded",
    db,
    dbLatencyMs: Date.now() - startedAt,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    time: new Date().toISOString(),
  };
  return Response.json(body, { status: db ? 200 : 503 });
}
