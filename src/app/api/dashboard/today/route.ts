import { ok } from "@/lib/api";
import { getTodaySummary } from "@/lib/dashboard";

export async function GET() {
  return ok(await getTodaySummary());
}
