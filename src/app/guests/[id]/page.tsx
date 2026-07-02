import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHead, SectionLabel, KPI, StatusPill, ChannelBadge, Icon, EmptyState } from "@/components/ui";
import { GuestProfile } from "@/components/GuestProfile";
import { IdDocumentField } from "@/components/IdDocumentField";
import { isStorageConfigured } from "@/lib/storage";
import { displayMoney, displayINR, displayShortDate } from "@/lib/format";
import { formatDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { kind: "good" | "ink" | "danger"; label: string }> = {
  confirmed: { kind: "good", label: "Confirmed" },
  cancelled: { kind: "ink", label: "Cancelled" },
  no_show: { kind: "danger", label: "No-show" },
};

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        include: { room: { include: { roomType: true } }, channel: true },
        orderBy: { checkIn: "desc" },
      },
    },
  });
  if (!guest) notFound();
  const scamEntry = await prisma.flaggedNumber.findUnique({ where: { phone: guest.phone } });

  const stays = guest.reservations;
  const realised = stays.filter((r) => r.status !== "cancelled");
  const lifetime = realised.reduce((sum, r) => sum + (r.grossAmount ? Number(r.grossAmount) : 0), 0);
  const isRepeat = realised.length >= 2;

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <Link href="/guests" className="btn btn--ghost btn--sm" style={{ paddingLeft: 6, marginBottom: 8 }}>
          <Icon name="chevronL" size={16} /> All guests
        </Link>

        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <PageHead title={guest.name} sub={`${guest.phone}${guest.email ? ` · ${guest.email}` : ""}`} />
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {isRepeat && <StatusPill kind="teal">Repeat guest</StatusPill>}
          {guest.blocked && <StatusPill kind="danger">Blacklisted</StatusPill>}
          {guest.nationality && <StatusPill kind="ink">Foreign · C-Form</StatusPill>}
          <Link href={`/guests/${guest.id}/registration`} className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }}>
            <Icon name="receipt" size={15} /> Registration card
          </Link>
        </div>

        {guest.blocked && guest.blockReason && (
          <div className="banner banner--danger" style={{ cursor: "default", marginTop: 12 }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}>{guest.blockReason}</span>
          </div>
        )}
        {scamEntry && (
          <div className="banner banner--warn" style={{ cursor: "default", marginTop: 12 }}>
            <span className="banner__icon"><Icon name="alert" size={18} /></span>
            <span style={{ flex: 1 }}>
              <b>On scam list</b>{scamEntry.reason ? ` — ${scamEntry.reason}` : ""}
            </span>
          </div>
        )}

        <div className="kpi-grid" style={{ marginTop: 16 }}>
          <KPI value={realised.length} label="Stays" sub={isRepeat ? "Returning" : "First-timer"} icon="bed" tone="teal" />
          <KPI value={displayINR(lifetime)} label="Lifetime value" icon="wallet" />
        </div>

        <GuestProfile
          initial={{
            id: guest.id,
            name: guest.name,
            email: guest.email ?? "",
            idNumber: guest.idNumber ?? "",
            notes: guest.notes ?? "",
            address: guest.address ?? "",
            vehicleNumber: guest.vehicleNumber ?? "",
            emergencyContactName: guest.emergencyContactName ?? "",
            emergencyContactPhone: guest.emergencyContactPhone ?? "",
            preferences: guest.preferences.join(", "),
            idChecked: guest.idChecked,
            idPhotocopied: guest.idPhotocopied,
            idVerificationCompleted: guest.idVerificationCompleted,
            consentGiven: guest.consentGivenAt !== null,
            blocked: guest.blocked,
            blockReason: guest.blockReason ?? "",
            nationality: guest.nationality ?? "",
            passportNumber: guest.passportNumber ?? "",
            passportIssueDate: guest.passportIssueDate ? formatDateOnly(guest.passportIssueDate) : "",
            passportIssuePlace: guest.passportIssuePlace ?? "",
            passportExpiry: guest.passportExpiry ? formatDateOnly(guest.passportExpiry) : "",
            visaNumber: guest.visaNumber ?? "",
            visaType: guest.visaType ?? "",
            visaIssueDate: guest.visaIssueDate ? formatDateOnly(guest.visaIssueDate) : "",
            visaIssuePlace: guest.visaIssuePlace ?? "",
            visaExpiry: guest.visaExpiry ? formatDateOnly(guest.visaExpiry) : "",
            portOfEntry: guest.portOfEntry ?? "",
            arrivalInIndia: guest.arrivalInIndia ? formatDateOnly(guest.arrivalInIndia) : "",
            purposeOfVisit: guest.purposeOfVisit ?? "",
          }}
        />

        <IdDocumentField
          guestId={guest.id}
          configured={isStorageConfigured()}
          hasDocument={guest.idDocumentPath !== null}
        />

        <SectionLabel count={`(${stays.length})`}>Stay history</SectionLabel>
        {stays.length === 0 ? (
          <EmptyState>No bookings yet.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {stays.map((r) => {
              const st = STATUS[r.status] ?? STATUS.confirmed;
              return (
                <Link key={r.id} href={`/reservations/${r.id}`} className="card" style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--fs-body)" }}>
                      {displayShortDate(r.checkIn)} → {displayShortDate(r.checkOut)}
                    </div>
                    <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 3 }}>
                      Room {r.room.label} · {r.room.roomType.name}
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: "flex-end", gap: 5 }}>
                    <ChannelBadge name={r.channel.name} />
                    <span style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", fontWeight: 600 }}>
                      <span className="num">{displayMoney(r.grossAmount)}</span>
                      {r.status !== "confirmed" && <> · <StatusPill kind={st.kind}>{st.label}</StatusPill></>}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
