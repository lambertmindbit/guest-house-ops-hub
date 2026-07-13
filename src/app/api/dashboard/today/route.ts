import { ok, withRoute } from "@/lib/api";
import { getTodaySummary } from "@/lib/dashboard";

async function handleGET() {
  return ok(await getTodaySummary());
}

export const GET = withRoute(handleGET);
