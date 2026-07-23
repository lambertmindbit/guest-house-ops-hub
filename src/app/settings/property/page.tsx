import { SubHeader } from "@/components/settings/SubHeader";
import { PropertySection } from "@/components/settings/sections";
import { Icon } from "@/components/ui";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { currentPropertySettings } from "@/lib/property-settings";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await currentPropertySettings();
  const settings = s && {
    name: s.name,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    currency: s.currency,
    timezone: s.timezone,
    address: s.address,
    gstNumber: s.gstNumber,
    upiVpa: s.upiVpa,
    idRetentionDays: s.idRetentionDays,
    idPolicy: s.idPolicy,
    idRequiredAtBooking: s.idRequiredAtBooking,
    inspectionRequired: s.inspectionRequired,
    invoicePrefix: s.invoicePrefix,
    gstSlabs: (s.gstSlabs as { uptoPaise: number | null; ratePct: number }[] | null) ?? null,
  };

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Property details" sub="Name, address, GST, check-in/out times" />
        <PropertySection settings={settings} />
        <div style={{ marginTop: 14 }}>
          <LanguageSwitcher />
        </div>

        {/* Client data export / offboarding (GAP-23). */}
        <div className="card card--pad" style={{ marginTop: 14 }}>
          <div className="h3">Data &amp; offboarding</div>
          <div className="muted" style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>
            Download everything held for this property — bookings, guests, finance, setup and history — as one JSON file.
            It&apos;s yours to keep or hand to an accountant. Money values are in paise (÷100 for rupees).
          </div>
          <a href="/api/settings/export" download className="btn btn--ghost btn--sm" style={{ marginTop: 12 }}>
            <Icon name="receipt" size={15} /> Export all property data
          </a>
        </div>
      </div>
    </main>
  );
}
