import { withRoute, fail } from "@/lib/api";
import { getSession } from "@/lib/session";
import { toCsv, csvResponse } from "@/lib/csv";
import { listFaqs } from "@/lib/faq";

// GET /api/faq/export.csv — every FAQ (live AND hidden drafts) as a spreadsheet
// the owner can send to a client to fill in. Opens directly in Excel / Google
// Sheets. Owner-only: FAQ content is what the guest bot speaks.
//
// The `ID` column is what makes a round-trip possible later: keep it on rows you
// EDIT, and leave it blank on rows you ADD.
async function handleGET() {
  const session = await getSession();
  if (session?.role !== "owner") return fail("Owners only.", 403);

  const faqs = await listFaqs();

  const headers = ["ID", "Question", "Answer", "Category", "Status"];
  const rows = faqs.map((f) => [
    f.id,
    f.question,
    f.answer,
    f.category ?? "",
    f.active ? "Live" : "Hidden",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`faqs_${stamp}.csv`, toCsv(headers, rows));
}

export const GET = withRoute(handleGET);
