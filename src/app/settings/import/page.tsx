import { SubHeader } from "@/components/settings/SubHeader";
import { ImportTool } from "@/components/settings/ImportTool";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Import data" sub="Bring guests & bookings over from paper / WhatsApp (CSV)" />
        <ImportTool />
      </div>
    </main>
  );
}
