import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelBadge, Icon } from "@/components/ui";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { StayActions } from "@/components/StayActions";
import { ReservationOverflow } from "@/components/ReservationOverflow";
import { RefundPanel } from "@/components/RefundPanel";
import { displayDate, displayMoney } from "@/lib/format";
import { formatDateOnly, todayDateOnly } from "@/lib/dates";
import { checkInBlockReason } from "@/lib/id-gate";
import { getCancellationPolicy, isPeakDate, daysUntil, assessRefund, type SeasonWindow } from "@/lib/cancellation";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { cls: string; label: string }> = {
  confirmed: { cls: "badge--good", label: "Confirmed" },
  cancelled: { cls: "badge--neutral", label: "Cancelled" },
  no_show: { cls: "badge--danger", label: "No-show" },
};

function nightsBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// WhatsApp deep link — international digits, no "+". Bare 10-digit numbers are
// assumed Indian (+91), matching the property's market.
function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}`;
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [r, property] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        channel: true,
        room: { include: { roomType: true } },
        payments: { orderBy: { paidAt: "asc" } },
        refunds: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.propertySettings.findFirst(),
  ]);
  if (!r) notFound();

  const status = STATUS[r.status] ?? STATUS.confirmed;
  const nights = nightsBetween(r.checkIn, r.checkOut);

  // Cancellation refund assessment (only needed once a booking is cancelled).
  let refundView: {
    collected: number;
    suggestedRefund: number;
    freeWindowDays: number;
    withinFreeWindow: boolean;
  } | null = null;
  if (r.status === "cancelled") {
    const [policy, seasons] = await Promise.all([
      getCancellationPolicy(),
      prisma.season.findMany(),
    ]);
    const seasonWindows: SeasonWindow[] = seasons.map((s) => ({
      startDate: formatDateOnly(s.startDate),
      endDate: formatDateOnly(s.endDate),
      adjustPct: Number(s.adjustPct),
    }));
    const collected = r.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const assessment = assessRefund({
      policy,
      isPeak: isPeakDate(seasonWindows, formatDateOnly(r.checkIn)),
      daysUntilCheckIn: daysUntil(todayDateOnly(), formatDateOnly(r.checkIn)),
      collected,
    });
    refundView = { collected, ...assessment };
  }

  return (
    <main className="app-main" style={{ maxWidth: 620 }}>
      <div className="entrance">
        <Link href="/calendar" className="backlink"><Icon name="chevronL" size={15} /> Back to calendar</Link>

        {/* header */}
        <div className="row" style={{ gap: 13, marginBottom: 14 }}>
          <span className="avatar">{initials(r.guest.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="h2" style={{ fontSize: "var(--fs-h2)" }}>{r.guest.name}</span>
              <span className={`badge ${status.cls}`}>{status.cls === "badge--good" && <span className="dot" />}{status.label}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: "var(--fs-meta)" }}>{r.guest.phone}</span>
              <ChannelBadge name={r.channel.name} />
            </div>
          </div>
        </div>

        {/* info card */}
        <div className="card card--pad">
          <div className="spread" style={{ marginBottom: 10 }}>
            <div>
              <div className="eyebrow">Room</div>
              <div className="h3" style={{ marginTop: 3 }}>{r.room.label} · {r.room.roomType.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="eyebrow">Amount</div>
              <div className="h3 money" style={{ marginTop: 3, fontSize: "var(--fs-h2)" }}>{displayMoney(r.grossAmount)}</div>
              {r.advanceRequired && (
                <div className="muted" style={{ fontSize: "var(--fs-meta)", marginTop: 2 }}>
                  Advance: {displayMoney(r.advanceRequired)}
                </div>
              )}
            </div>
          </div>
          <hr className="hairline" style={{ margin: "12px 0" }} />
          <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
            <Fact label="Check-in" value={displayDate(r.checkIn)} />
            <Fact label="Check-out" value={displayDate(r.checkOut)} />
            <Fact label="Nights" value={String(nights)} />
            {r.arrivalTime && <Fact label="Arrival" value={r.arrivalTime} />}
            {r.otaRef && <Fact label="OTA ref" value={r.otaRef} />}
          </div>
          <hr className="hairline" style={{ margin: "12px 0" }} />
          <div className="eyebrow">Special requests</div>
          <div style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>
            {r.specialRequests || <span className="muted">None</span>}
          </div>

          {/* Registration: ID status + (for foreign guests) a C-Form badge. */}
          <hr className="hairline" style={{ margin: "12px 0" }} />
          <div className="spread">
            <div>
              <div className="eyebrow">Registration</div>
              <div style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>
                {r.guest.idDocumentPath
                  ? "ID document on file"
                  : r.guest.idNumber
                  ? `ID: ${r.guest.idNumber}`
                  : <span className="muted">No ID on file</span>}
              </div>
            </div>
            {r.guest.nationality && (
              <span className="badge badge--neutral">C-Form · {r.guest.nationality}</span>
            )}
          </div>
        </div>

        {/* contextual hero action */}
        {r.status === "confirmed" && (
          <StayActions
            reservationId={r.id}
            checkedInAt={r.checkedInAt ? r.checkedInAt.toISOString() : null}
            checkedOutAt={r.checkedOutAt ? r.checkedOutAt.toISOString() : null}
            idBlockReason={checkInBlockReason(r.guest)}
            guestId={r.guestId}
          />
        )}

        {/* secondary action: message the guest on WhatsApp */}
        <a
          href={waLink(r.guest.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 12 }}
        >
          <Icon name="phone" size={16} /> Message guest on WhatsApp
        </a>

        <PaymentsPanel
          reservationId={r.id}
          gross={r.grossAmount ? Number(r.grossAmount) : 0}
          advanceRequired={r.advanceRequired ? Number(r.advanceRequired) : 0}
          upi={property?.upiVpa ? { vpa: property.upiVpa, payeeName: property.name } : undefined}
          payments={r.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            mode: p.mode,
            isAdvance: p.isAdvance,
            paidAt: p.paidAt.toISOString(),
            note: p.note,
          }))}
        />

        {/* Cancellation & refund — appears once the booking is cancelled. */}
        {refundView && (
          <RefundPanel
            reservationId={r.id}
            collected={refundView.collected}
            suggestedRefund={refundView.suggestedRefund}
            freeWindowDays={refundView.freeWindowDays}
            withinFreeWindow={refundView.withinFreeWindow}
            refunds={r.refunds.map((rf) => ({
              id: rf.id,
              amount: Number(rf.amount),
              status: rf.status,
              reason: rf.reason,
              approvedAt: rf.approvedAt ? rf.approvedAt.toISOString() : null,
              createdAt: rf.createdAt.toISOString(),
            }))}
          />
        )}

        {/* footer: Edit · Invoice · ⋯ (Cancel inside the overflow) */}
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <Link href={`/reservations/${r.id}/edit`} className="btn btn--ghost" style={{ flex: 1 }}>
            <Icon name="edit" size={15} /> Edit
          </Link>
          <Link href={`/reservations/${r.id}/invoice`} className="btn btn--ghost" style={{ flex: 1 }}>
            <Icon name="receipt" size={15} /> Invoice
          </Link>
          {r.status === "confirmed" && <ReservationOverflow id={r.id} />}
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div style={{ fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{value}</div>
    </div>
  );
}
