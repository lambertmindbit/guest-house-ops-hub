import { listRequests, listAssets, preventiveDue, type AssetForDue } from "@/lib/maintenance";
import { listStaff } from "@/lib/staff";
import { todayDateOnly, formatDateOnly } from "@/lib/dates";
import { PageHead } from "@/components/ui";
import { MaintenanceBoard } from "@/components/MaintenanceBoard";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  await requireModule("maintenance");
  const today = todayDateOnly();
  const [requests, assets, staff] = await Promise.all([listRequests(), listAssets(), listStaff()]);

  const assetRows: AssetForDue[] = assets.map((a) => ({
    id: a.id, name: a.name, preventiveEveryDays: a.preventiveEveryDays,
    lastServicedAt: a.lastServicedAt ? formatDateOnly(a.lastServicedAt) : null,
  }));
  const dueIds = new Set(preventiveDue(assetRows, today).map((a) => a.id));

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <PageHead title="Maintenance" sub="Requests, asset register and preventive service." />
        <MaintenanceBoard
          requests={requests.map((r) => ({
            id: r.id, title: r.title, status: r.status, priority: r.priority,
            assigneeStaffId: r.assigneeStaffId, cost: r.cost == null ? null : Number(r.cost),
          }))}
          assets={assets.map((a) => ({
            id: a.id, name: a.name, category: a.category, preventiveEveryDays: a.preventiveEveryDays,
            lastServicedAt: a.lastServicedAt ? formatDateOnly(a.lastServicedAt) : null, due: dueIds.has(a.id),
          }))}
          staff={staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </main>
  );
}
