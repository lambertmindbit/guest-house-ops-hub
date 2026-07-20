import { fail, withRoute } from "@/lib/api";
import { exportGuestData } from "@/lib/dpdp";
import { recordAudit } from "@/lib/audit";

// DPDP right to access (GAP-8/US-202): everything this deployment holds about one
// guest, machine-readable, with a manifest of what is withheld and why. Downloading
// personal data is itself auditable.
async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await exportGuestData(id);
  if (!data) return fail("guest not found", 404);

  await recordAudit("guest.export", "guest", id, "Exported the guest's personal data").catch(() => {});

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="guest-data-${id}.json"`,
    },
  });
}

export const GET = withRoute(handleGET);
