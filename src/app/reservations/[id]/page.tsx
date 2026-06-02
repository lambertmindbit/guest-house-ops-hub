import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelBadge, StatusPill, Icon } from "@/components/ui";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { displayDate, displayMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { kind: "good" | "ink" | "danger"; label: string }> = {
  confirmed: { kind: "good", label: "Confirmed" },
  cancelled: { kind: "ink", label: "Cancelled" },
  no_show: { kind: "danger", label: "No-show" },
};

function nightsBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
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
      <div className="shimmer">
        <Link href="/calendar" className="btn btn--ghost btn--sm" style={{ paddingLeft: 6, marginBottom: 8 }}>
          <Icon name="chevronL" size={16} /> Back to calendar
        </Link>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{r.guest.name}</h1>
            <div className="row" style={{ gap: 6, color: "var(--subtle)", fontSize: 13.5, marginTop: 4 }}>
              <Icon name="phone" size={14} /> {r.guest.phone}
              {r.guest.email ? ` · ${r.guest.email}` : ""}
            </div>
          </div>
          <StatusPill kind={status.kind}>
            {status.kind === "good" && <span className="dot" />}
            {status.label}
          </StatusPill>
        </div>

        <div className="card" style={{ padding: "4px 16px", marginTop: 16 }}>
          <Row label="Room">
            <span className="row" style={{ gap: 7, justifyContent: "flex-end" }}>
              <Icon name="door" size={15} /> {r.room.label} · {r.room.roomType.name}
            </span>
          </Row>
          <Row label="Channel"><ChannelBadge name={r.channel.name} /></Row>
          <Row label="Check-in">{displayDate(r.checkIn)}</Row>
          <Row label="Check-out">{displayDate(r.checkOut)} · {nights} {nights === 1 ? "night" : "nights"}</Row>
          {r.arrivalTime && <Row label="Arrival time">{r.arrivalTime}</Row>}
          <Row label="Amount"><span className="num">{displayMoney(r.grossAmount)}</span></Row>
          {r.otaRef && <Row label="OTA ref">{r.otaRef}</Row>}
          <div style={{ padding: "13px 0" }}>
            <div style={{ fontSize: 13.5, color: "var(--subtle)", marginBottom: 6 }}>Special requests</div>
            <div style={{ fontSize: 14.5 }}>{r.specialRequests || <span style={{ color: "var(--subtle)" }}>None</span>}</div>
          </div>
        </div>

        <PaymentsPanel
          reservationId={r.id}
          gross={r.grossAmount ? Number(r.grossAmount) : 0}
          payments={r.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            mode: p.mode,
            paidAt: p.paidAt.toISOString(),
            note: p.note,
          }))}
        />

        <div style={{ height: 16 }} />
        <Link href={`/reservations/${r.id}/edit`} className="btn btn--primary btn--block">
          <Icon name="edit" size={17} /> Edit reservation
        </Link>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 13.5, color: "var(--subtle)" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 14.5, textAlign: "right" }}>{children}</span>
    </div>
  );
}
