import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listUserProperties } from "@/lib/properties";
import { SubHeader } from "@/components/settings/SubHeader";
import { PropertiesManager } from "@/components/PropertiesManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const properties = await listUserProperties(session.sub, session.propertyId);

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Properties" sub="Add a property, or switch between the ones you run" />
        <PropertiesManager properties={properties} currentId={session.propertyId ?? null} />
      </div>
    </main>
  );
}
