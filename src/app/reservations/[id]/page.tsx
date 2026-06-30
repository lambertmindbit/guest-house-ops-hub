import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelBadge, Icon } from "@/components/ui";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { StayActions } from "@/components/StayActions";
import { ReservationOverflow } from "@/components/ReservationOverflow";
import { displayDate, displayMoney } from "@/lib/format";

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
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      guest: true,
      channel: true,
      room: { include: { roomType: true } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!r) notFound();

  const status = STATUS[r.status] ?? STATUS.confirmed;
  const nights = nightsBetween(r.checkIn, r.checkOut);

  return (
    <main className="app-main" style={{ maxWidth: 620 }}>
      <div className="entrance">
        <Link href="/calendar" className="backlink"><Icon name="chevronL" size={15} /> Back to calendar</Link>

        {/* header */}
        <div className="row" style={{ gap: 13, marginBottom: 14 }}>
          <span className="avatar">{initials(r.guest.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="h2" style={{ fontSize: 20 }}>{r.guest.name}</span>
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
              <div className="h3 money" style={{ marginTop: 3, fontSize: 18 }}>{displayMoney(r.grossAmount)}</div>
              {r.advanceRequired && (
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
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
          payments={r.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            mode: p.mode,
            isAdvance: p.isAdvance,
            paidAt: p.paidAt.toISOString(),
            note: p.note,
          }))}
        />

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
