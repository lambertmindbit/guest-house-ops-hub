import { getAnalytics } from "@/lib/analytics";
import { analyticsCsv } from "@/lib/analytics-csv";
import { currentMonthRange } from "@/lib/finance";

// GET /api/analytics/export?from=&to= → the current Analytics view as a CSV
// download. Owner-only: middleware redirects non-owners because "/api/analytics"
// is in OWNER_ONLY_PREFIXES (src/lib/authz.ts) — the API path is listed
// separately from the "/analytics" page path. Invalid/missing dates fall back to
// the current month, mirroring the page.
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = currentMonthRange();
  const from = isDate(searchParams.get("from")) ? searchParams.get("from")! : month.from;
  const to = isDate(searchParams.get("to")) ? searchParams.get("to")! : month.to;

  const csv = analyticsCsv(await getAnalytics(from, to));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${from}_to_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
