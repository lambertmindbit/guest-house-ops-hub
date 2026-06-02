// Minimal RFC-4180 CSV builder — no dependency. Quotes any field containing a
// comma, quote, or newline and escapes embedded quotes by doubling them.
type Cell = string | number | null | undefined;

function escape(value: Cell): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
