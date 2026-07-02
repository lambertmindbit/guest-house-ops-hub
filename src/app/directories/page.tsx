import { getSession, requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { sharedVendors, sharedDrivers } from "@/lib/community/directories";

export const dynamic = "force-dynamic";

export default async function DirectoriesPage() {
  await requireRole(["owner", "reception"]);
  const session = await getSession();
  const pid = session?.propertyId ?? null;

  const [vendors, drivers] = pid
    ? await Promise.all([sharedVendors(pid), sharedDrivers(pid)])
    : [[], []];

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Trusted lists" sub="Vendors and drivers shared by your network." />

        <div className="setgroup__label">Vendors &amp; contacts</div>
        {vendors.length === 0 ? (
          <div className="empty" style={{ marginBottom: 14 }}>No shared vendors. Ask peers to enable vendor sharing in their Trusted network.</div>
        ) : (
          <div className="col" style={{ gap: 8, marginBottom: 14 }}>
            {vendors.map((v) => (
              <div key={v.id} className="card card--pad" style={{ padding: 14 }}>
                <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.name}{v.category ? <span className="badge badge--neutral" style={{ marginLeft: 8 }}>{v.category}</span> : null}</div>
                    <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Shared by {v.ownerName}{v.rating ? ` · ${"★".repeat(v.rating)}` : ""}</div>
                  </div>
                  {v.contact && <a className="btn btn--ghost btn--sm" href={`tel:${v.contact}`}>{v.contact}</a>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="setgroup__label">Drivers &amp; transport</div>
        {drivers.length === 0 ? (
          <div className="empty">No shared drivers. Ask peers to enable transport sharing.</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {drivers.map((d) => (
              <div key={d.id} className="card card--pad" style={{ padding: 14 }}>
                <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.name}{d.vehicleNumber ? <span className="muted" style={{ fontWeight: 400 }}> · {d.vehicleNumber}</span> : null}</div>
                    <div className="muted" style={{ fontSize: "var(--fs-meta)" }}>Shared by {d.ownerName}</div>
                  </div>
                  {d.phone && <a className="btn btn--ghost btn--sm" href={`tel:${d.phone}`}>{d.phone}</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
