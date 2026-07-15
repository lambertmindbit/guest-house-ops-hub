import { requirePlatformAdmin } from "@/lib/session";
import { unscopedPrisma } from "@/lib/prisma";
import { MODULES } from "@/lib/modules";
import { AdminModules } from "@/components/AdminModules";

export const dynamic = "force-dynamic";

// The vendor's console. 404s for everyone else — including the client's own owner
// (see requirePlatformAdmin), because a module a client didn't buy should not
// advertise itself as a locked door.
//
// unscopedPrisma is used deliberately and is safe HERE: each client has their own
// database, so "every property in this database" means "this client's properties",
// not "every client". It is the one place that needs to see properties before a
// tenant is bound.
export default async function AdminPage() {
  await requirePlatformAdmin();

  const properties = await unscopedPrisma.propertySettings.findMany({
    select: { id: true, name: true, disabledModules: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-main">
      <div className="entrance">
        <div className="pagehead">
          <div className="display">Admin</div>
          <div className="pagehead__sub">
            Vendor console · {properties.length} propert{properties.length === 1 ? "y" : "ies"} on this deployment
          </div>
        </div>

        <div className="banner banner--warn" style={{ marginBottom: 18 }}>
          <span className="banner__txt">
            <b>Only you see this.</b> The client&rsquo;s owner cannot reach it. Switching a module off hides it from
            their navigation and makes its pages show the not-found screen. It deletes no data, and switching it
            back on restores everything.
          </span>
        </div>

        {properties.length === 0 ? (
          <div className="empty">No properties yet — seed one first.</div>
        ) : (
          properties.map((p) => (
            <AdminModules
              key={p.id}
              propertyId={p.id}
              propertyName={p.name}
              modules={MODULES}
              disabled={p.disabledModules}
            />
          ))
        )}
      </div>
    </main>
  );
}
