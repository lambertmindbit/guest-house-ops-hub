import { SubHeader } from "@/components/settings/SubHeader";
import { PropertySection } from "@/components/settings/sections";
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
  };

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Property details" sub="Name, address, GST, check-in/out times" />
        <PropertySection settings={settings} />
      </div>
    </main>
  );
}
