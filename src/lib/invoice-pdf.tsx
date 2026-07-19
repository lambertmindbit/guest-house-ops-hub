// Explicit React import: this module is rendered outside Next's automatic JSX
// runtime (server route + tests), where the classic runtime needs React in scope.
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatPaise } from "@/lib/money";

// Server-side invoice PDF (GAP-11/US-206). Renders ONLY from the issued snapshot,
// so a download years later is identical to the original — no recomputation.
// @react-pdf/renderer is pure JS (no headless browser), so it runs on serverless.

export type InvoiceSnapshot = {
  number: string;
  issuedAt: Date;
  cancelledAt: Date | null;
  propertyName: string;
  propertyAddress: string | null;
  propertyGstin: string | null;
  guestName: string;
  guestPhone: string | null;
  nights: number;
  taxRatePct: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  paidPaise: number;
  lines: { description: string; qty: number; unitPaise: number; amountPaise: number }[];
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#111827", fontFamily: "Helvetica" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  block: { marginTop: 18 },
  label: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111827", paddingBottom: 4, marginTop: 18 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 6 },
  cDesc: { flex: 1 },
  cQty: { width: 50, textAlign: "right" },
  cAmt: { width: 90, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 240 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { borderTopWidth: 1.5, borderTopColor: "#111827", marginTop: 5, paddingTop: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  cancel: { marginTop: 10, padding: 6, backgroundColor: "#fee2e2", color: "#991b1b", fontFamily: "Helvetica-Bold" },
  foot: { marginTop: 28, fontSize: 8, color: "#6b7280" },
});

function InvoiceDoc({ inv }: { inv: InvoiceSnapshot }) {
  const balance = inv.totalPaise - inv.paidPaise;
  return (
    <Document title={`Invoice ${inv.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.h1}>{inv.propertyName}</Text>
            {inv.propertyAddress ? <Text style={s.muted}>{inv.propertyAddress}</Text> : null}
            {inv.propertyGstin ? <Text style={s.muted}>GSTIN: {inv.propertyGstin}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.bold}>{inv.propertyGstin ? "TAX INVOICE" : "INVOICE"}</Text>
            <Text style={s.muted}>{inv.number}</Text>
            <Text style={s.muted}>{inv.issuedAt.toISOString().slice(0, 10)}</Text>
          </View>
        </View>

        {inv.cancelledAt ? <Text style={s.cancel}>CANCELLED</Text> : null}

        <View style={s.block}>
          <Text style={s.label}>Billed to</Text>
          <Text>{inv.guestName}</Text>
          {inv.guestPhone ? <Text style={s.muted}>{inv.guestPhone}</Text> : null}
        </View>

        <View style={s.thead}>
          <Text style={[s.cDesc, s.label]}>Description</Text>
          <Text style={[s.cQty, s.label]}>Nights</Text>
          <Text style={[s.cAmt, s.label]}>Amount</Text>
        </View>
        {inv.lines.map((l, i) => (
          <View style={s.tr} key={i}>
            <Text style={s.cDesc}>{l.description}</Text>
            <Text style={s.cQty}>{l.qty}</Text>
            <Text style={s.cAmt}>{formatPaise(l.amountPaise)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          {inv.taxRatePct > 0 ? (
            <>
              <View style={s.tRow}><Text>Taxable value</Text><Text>{formatPaise(inv.taxablePaise)}</Text></View>
              <View style={s.tRow}><Text>CGST @ {inv.taxRatePct / 2}%</Text><Text>{formatPaise(inv.cgstPaise)}</Text></View>
              <View style={s.tRow}><Text>SGST @ {inv.taxRatePct / 2}%</Text><Text>{formatPaise(inv.sgstPaise)}</Text></View>
            </>
          ) : (
            <View style={s.tRow}><Text>Subtotal</Text><Text>{formatPaise(inv.taxablePaise)}</Text></View>
          )}
          {inv.roundOffPaise !== 0 ? (
            <View style={s.tRow}><Text>Round off</Text><Text>{formatPaise(inv.roundOffPaise)}</Text></View>
          ) : null}
          <View style={[s.tRow, s.grand]}>
            <Text style={s.bold}>Total</Text>
            <Text style={s.bold}>{formatPaise(inv.totalPaise)}</Text>
          </View>
          <View style={s.tRow}><Text>Paid</Text><Text>− {formatPaise(inv.paidPaise)}</Text></View>
          <View style={s.tRow}>
            <Text style={s.bold}>{balance > 0 ? "Balance due" : "Balance"}</Text>
            <Text style={s.bold}>{formatPaise(balance)}</Text>
          </View>
        </View>

        <Text style={s.foot}>
          {inv.taxRatePct > 0
            ? "Tax charged on accommodation; place of supply is the location of the property (intra-state)."
            : "Not registered for GST — no tax charged on this invoice."}
        </Text>
        <Text style={s.foot}>Thank you for staying with {inv.propertyName}.</Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(inv: InvoiceSnapshot): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc inv={inv} />);
}
