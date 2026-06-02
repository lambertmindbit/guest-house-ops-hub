// Minimal RFC-4180 CSV builder — no dependency. Quotes any field containing a
// comma, quote, or newline and escapes embedded quotes by doubling them.
type Cell = string | number | null | undefined;

function escape(value: Cell): string {
  let s = value == null ? "" : String(value);
  // Formula-injection guard: a free-text cell (e.g. a guest-controlled name)
  // starting with = + - @ tab or CR is treated as a formula by Excel/Sheets.
  // Prefix a tab so spreadsheets render it as plain text. Only string cells —
  // numbers (incl. negative amounts) are emitted verbatim.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
  return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

// A download Response with the right headers so the browser saves a .csv file.
export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
