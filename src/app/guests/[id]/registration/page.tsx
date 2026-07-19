import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { formatDateOnly } from "@/lib/dates";
import { displayDate } from "@/lib/format";
import {
  guestRegistrationRows,
  cformRows,
  idComplianceRows,
  isForeignNational,
  type RegistrationGuest,
} from "@/lib/registration";
import { currentPropertySettings } from "@/lib/property-settings";

export const dynamic = "force-dynamic";

// Printable guest registration card (+ Form C for foreign nationals). Reuses the
// invoice print pattern: the `.invoice` card stays clean and app chrome is hidden
// by the global `@media print` rules.
export default async function RegistrationCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [guest, property] = await Promise.all([
    prisma.guest.findUnique({ where: { id } }),
    currentPropertySettings(),
  ]);
  if (!guest) notFound();

  // Audit the Form C artefact generation for a foreign guest (GAP-7 / accountability).
  const { isForeignGuest } = await import("@/lib/form-c");
  if (isForeignGuest(guest.nationality)) {
    const { recordAudit } = await import("@/lib/audit");
    await recordAudit("form-c.generate", "guest", id, `Generated Form C for ${guest.name}`).catch(() => {});
  }

  const g: RegistrationGuest = {
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    address: guest.address,
    vehicleNumber: guest.vehicleNumber,
    idNumber: guest.idNumber,
    emergencyContactName: guest.emergencyContactName,
    emergencyContactPhone: guest.emergencyContactPhone,
    preferences: guest.preferences,
    idChecked: guest.idChecked,
    idPhotocopied: guest.idPhotocopied,
    idUploaded: guest.idUploaded,
    idVerificationCompleted: guest.idVerificationCompleted,
    nationality: guest.nationality,
    passportNumber: guest.passportNumber,
    passportIssuePlace: guest.passportIssuePlace,
    passportIssueDate: guest.passportIssueDate ? formatDateOnly(guest.passportIssueDate) : null,
    passportExpiry: guest.passportExpiry ? formatDateOnly(guest.passportExpiry) : null,
    visaNumber: guest.visaNumber,
    visaType: guest.visaType,
    visaIssuePlace: guest.visaIssuePlace,
    visaIssueDate: guest.visaIssueDate ? formatDateOnly(guest.visaIssueDate) : null,
    visaExpiry: guest.visaExpiry ? formatDateOnly(guest.visaExpiry) : null,
    portOfEntry: guest.portOfEntry,
    arrivalInIndia: guest.arrivalInIndia ? formatDateOnly(guest.arrivalInIndia) : null,
    purposeOfVisit: guest.purposeOfVisit,
  };

  const propName = property?.name ?? "Guest House";
  const foreign = isForeignNational(g);

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <Link href={`/guests/${guest.id}`} className="btn btn--ghost btn--sm" style={{ paddingLeft: 6 }}>
            <Icon name="chevronL" size={16} /> Back
          </Link>
          <PrintButton />
        </div>

        <div className="invoice card" style={{ padding: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ fontSize: "var(--fs-h2)", fontWeight: 800, letterSpacing: "-0.02em" }}>{propName}</div>
              {property?.address && (
                <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 4, whiteSpace: "pre-line" }}>{property.address}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "var(--fs-h2)", fontWeight: 800, letterSpacing: "0.04em", color: "var(--accent-text)" }}>
                REGISTRATION
              </div>
              <div style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginTop: 4 }}>
                {displayDate(new Date())}
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "20px 0" }} />

          <RegSection title="Guest details" rows={guestRegistrationRows(g)} />

          <div style={{ marginTop: 22 }}>
            <SectionEyebrow>ID &amp; verification</SectionEyebrow>
            <div className="row" style={{ gap: 16, flexWrap: "wrap", marginTop: 8 }}>
              {idComplianceRows(g).map((c) => (
                <span key={c.label} style={{ fontSize: "var(--fs-small)", display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 700 }}>{c.done ? "☑" : "☐"}</span> {c.label}
                </span>
              ))}
            </div>
          </div>

          {foreign && (
            <div style={{ marginTop: 22 }}>
              <RegSection title="Form C — foreign national registration" rows={cformRows(g)} />
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "24px 0 14px" }} />
          <div className="row" style={{ justifyContent: "space-between", gap: 20, marginTop: 30 }}>
            <SignLine label="Guest signature" />
            <SignLine label={`For ${propName}`} />
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "var(--fs-micro)", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

function RegSection({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div>
      <SectionEyebrow>{title}</SectionEyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ fontSize: "var(--fs-micro)", color: "var(--text-subtle)" }}>{r.label}</div>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--ink)" }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignLine({ label }: { label: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ borderTop: "1px solid var(--ink)", marginBottom: 4 }} />
      <div style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>{label}</div>
    </div>
  );
}
