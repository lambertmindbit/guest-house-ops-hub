import { fail, withRoute } from "@/lib/api";
import { exportPropertyData } from "@/lib/property-export";
import { currentRole } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

// Client data export / offboarding (GAP-23). The whole property's data as one JSON
// download. Owner-only, and taking a full copy of the business's data is audited.
async function handleGET() {
  if ((await currentRole()) !== "owner") return fail("Only the owner can export the property's data.", 403);

  const data = await exportPropertyData();
  await recordAudit("property.export", "property_settings", data.property?.id ?? "unknown", "Exported the full property data set").catch(() => {});

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="property-data-${stamp}.json"`,
    },
  });
}

export const GET = withRoute(handleGET);
