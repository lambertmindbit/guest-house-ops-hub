import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { displayDate, displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";
import { currentPropertySettings } from "@/lib/property-settings";
import { invoiceForReservation } from "@/lib/invoices";
import { IssueInvoiceButton } from "@/components/IssueInvoiceButton";

export const dynamic = "force-dynamic";

const nightsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, property, inv] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: { include: { roomType: true } }, channel: true, payments: { orderBy: { paidAt: "asc" } } },
    }),
    currentPropertySettings(),
    invoiceForReservation(id),
  ]);
  if (!r) notFound();

  // Once issued, EVERY figure comes from the frozen snapshot — never recomputed —
  // so a reprint is identical forever (GAP-11). Before issuing, this page is a
  // preview computed from the live booking.
  const nights = inv?.nights ?? nightsBetween(r.checkIn, r.checkOut);
  const gross = inv ? Number(inv.taxablePaise) + Number(inv.cgstPaise) + Number(inv.sgstPaise) : r.grossAmount ? Number(r.grossAmount) : 0;
  const collected = inv ? Number(inv.paidPaise) : r.payments.reduce((s, p) => s + Number(p.amount), 0);
  const total = inv ? Number(inv.totalPaise) : gross;
  const balance = total - collected;
  const taxRate = inv ? Number(inv.taxRatePct) : 0;
  const invoiceNo = inv?.number ?? "— not issued —";
  const propName = inv?.propertyName ?? property?.name ?? "Guest House";
  const propAddress = inv ? inv.propertyAddress : property?.address ?? null;
  const propGstin = inv ? inv.propertyGstin : property?.gstNumber ?? null;

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <Link href={`/reservations/${r.id}`} className="btn btn--ghost btn--sm" style={{ paddingLeft: 6 }}>
            <Icon name="chevronL" size={16} /> Back
          </Link>
          <div className="row" style={{ gap: 8 }}>
            {inv ? (
              <>
                <a href={`/api/reservations/${r.id}/invoice.pdf`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
                  <Icon name="receipt" size={15} /> PDF
                </a>
                <IssueInvoiceButton reservationId={r.id} reissue />
              </>
            ) : (
              <IssueInvoiceButton reservationId={r.id} />
            )}
            <PrintButton />
          </div>
        </div>

        {!inv && (
          <div className="banner banner--warn" style={{ cursor: "default", marginBottom: 14 }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}>
              <b>Preview — not yet issued.</b> Issuing assigns a permanent invoice number in this financial year&apos;s series and freezes these figures.
            </span>
          </div>
        )}
        {inv?.cancelledAt && (
          <div className="banner banner--danger" style={{ cursor: "default", marginBottom: 14 }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}><b>Cancelled.</b> This invoice was superseded by a re-issue.</span>
          </div>
        )}

        <div className="invoice card" style={{ padding: 28 }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ fontSize: "var(--fs-h2)", fontWeight: 800, letterSpacing: "-0.02em" }}>{propName}</div>
              {propAddress && <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 4, whiteSpace: "pre-line" }}>{propAddress}</div>}
              {propGstin && <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 2 }}>GSTIN: {propGstin}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--fs-h2)", fontWeight: 800, letterSpacing: "0.04em", color: "var(--accent-text)" }}>{propGstin ? "TAX INVOICE" : "INVOICE"}</div>
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 4 }}>{invoiceNo}</div>
              {r.otaRef && <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>Ref: {r.otaRef}</div>}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "20px 0" }} />

          {/* Bill to + stay */}
          <div className="invoice-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Billed to</div>
              <div style={{ fontWeight: 700, fontSize: "var(--fs-h3)", marginTop: 6 }}>{r.guest.name}</div>
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>{r.guest.phone}</div>
              {r.guest.email && <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>{r.guest.email}</div>}
            </div>
            <div>
              <div style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stay</div>
              <div style={{ fontSize: "var(--fs-body)", marginTop: 6 }}>{displayDate(r.checkIn)} → {displayDate(r.checkOut)}</div>
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>{nights} night{nights === 1 ? "" : "s"} · Room {r.room.label} · {r.room.roomType.name}</div>
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)" }}>Booked via {r.channel.name}</div>
            </div>
          </div>

          {/* Charges */}
          <table className="tbl" style={{ marginTop: 22 }}>
            <thead>
              <tr><th>Description</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              {inv ? (
                inv.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}, {l.qty} night{l.qty === 1 ? "" : "s"}</td>
                    <td className="r num">{displayINR(Number(l.amountPaise))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>Accommodation — Room {r.room.label} ({r.room.roomType.name}), {nights} night{nights === 1 ? "" : "s"}</td>
                  <td className="r num">{displayINR(gross)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals — tax lines appear only for a GST-registered property. */}
          <div style={{ marginTop: 16, marginLeft: "auto", width: "min(280px, 100%)" }}>
            {inv && taxRate > 0 ? (
              <>
                <TotalRow label="Taxable value" value={displayINR(Number(inv.taxablePaise))} />
                <TotalRow label={`CGST @ ${taxRate / 2}%`} value={displayINR(Number(inv.cgstPaise))} />
                <TotalRow label={`SGST @ ${taxRate / 2}%`} value={displayINR(Number(inv.sgstPaise))} />
              </>
            ) : (
              <TotalRow label="Subtotal" value={displayINR(gross)} />
            )}
            {inv && Number(inv.roundOffPaise) !== 0 && (
              <TotalRow label="Round off" value={displayINR(Number(inv.roundOffPaise))} />
            )}
            <div style={{ borderTop: "2px solid var(--ink)", marginTop: 6, paddingTop: 8 }}>
              <TotalRow label="Total" value={displayINR(total)} strong />
            </div>
            <TotalRow label="Paid" value={`− ${displayINR(collected)}`} />
            <TotalRow label={balance > 0 ? "Balance due" : "Balance"} value={displayINR(balance)} strong />
          </div>

          {/* Payments breakdown */}
          {r.payments.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Payments received</div>
              {r.payments.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: "space-between", fontSize: "var(--fs-small)", padding: "4px 0", color: "var(--text-subtle)" }}>
                  <span>{p.paidAt.toISOString().slice(0, 10)} · {PAYMENT_MODE_LABELS[p.mode] ?? p.mode}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="num">{displayINR(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "22px 0 14px" }} />
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)", lineHeight: 1.6 }}>
            Check-in from {property?.checkInTime ?? "14:00"} · Check-out by {property?.checkOutTime ?? "11:00"}.<br />
            Thank you for staying with {propName}.
          </div>
        </div>
      </div>
    </main>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ fontSize: strong ? 15 : 13.5, fontWeight: strong ? 800 : 500, color: strong ? "var(--ink)" : "var(--text-subtle)" }}>{label}</span>
      <span className="num" style={{ fontSize: strong ? 16 : 14, fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
}
