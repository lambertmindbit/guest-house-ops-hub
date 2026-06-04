import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { displayDate, displayINR, PAYMENT_MODE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

const nightsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, property] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: { include: { roomType: true } }, channel: true, payments: { orderBy: { paidAt: "asc" } } },
    }),
    prisma.propertySettings.findFirst(),
  ]);
  if (!r) notFound();

  const gross = r.grossAmount ? Number(r.grossAmount) : 0;
  const collected = r.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = gross - collected;
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const invoiceNo = `INV-${r.id.slice(-8).toUpperCase()}`;
  const propName = property?.name ?? "Guest House";

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <Link href={`/reservations/${r.id}`} className="btn btn--ghost btn--sm" style={{ paddingLeft: 6 }}>
            <Icon name="chevronL" size={16} /> Back
          </Link>
          <PrintButton />
        </div>

        <div className="invoice card" style={{ padding: 28 }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{propName}</div>
              {property?.address && <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 4, whiteSpace: "pre-line" }}>{property.address}</div>}
              {property?.gstNumber && <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 2 }}>GSTIN: {property.gstNumber}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.04em", color: "var(--accent-text)" }}>INVOICE</div>
              <div style={{ fontSize: 12.5, color: "var(--text-subtle)", marginTop: 4 }}>{invoiceNo}</div>
              {r.otaRef && <div style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>Ref: {r.otaRef}</div>}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "20px 0" }} />

          {/* Bill to + stay */}
          <div className="invoice-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Billed to</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>{r.guest.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>{r.guest.phone}</div>
              {r.guest.email && <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>{r.guest.email}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stay</div>
              <div style={{ fontSize: 13.5, marginTop: 6 }}>{displayDate(r.checkIn)} → {displayDate(r.checkOut)}</div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>{nights} night{nights === 1 ? "" : "s"} · Room {r.room.label} · {r.room.roomType.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>Booked via {r.channel.name}</div>
            </div>
          </div>

          {/* Charges */}
          <table className="tbl" style={{ marginTop: 22 }}>
            <thead>
              <tr><th>Description</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Accommodation — Room {r.room.label} ({r.room.roomType.name}), {nights} night{nights === 1 ? "" : "s"}</td>
                <td className="r num">{displayINR(gross)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginTop: 16, marginLeft: "auto", width: "min(280px, 100%)" }}>
            <TotalRow label="Total" value={displayINR(gross)} />
            <TotalRow label="Paid" value={`− ${displayINR(collected)}`} />
            <div style={{ borderTop: "2px solid var(--ink)", marginTop: 6, paddingTop: 8 }}>
              <TotalRow label={balance > 0 ? "Balance due" : "Balance"} value={displayINR(balance)} strong />
            </div>
          </div>

          {/* Payments breakdown */}
          {r.payments.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Payments received</div>
              {r.payments.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "var(--text-subtle)" }}>
                  <span>{p.paidAt.toISOString().slice(0, 10)} · {PAYMENT_MODE_LABELS[p.mode] ?? p.mode}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="num">{displayINR(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "22px 0 14px" }} />
          <div style={{ fontSize: 12, color: "var(--text-subtle)", lineHeight: 1.6 }}>
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
