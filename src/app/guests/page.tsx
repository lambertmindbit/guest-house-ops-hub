import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHead, EmptyState, Icon } from "@/components/ui";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const guests = await prisma.guest.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return (
    <main className="app-main">
      <div className="shimmer">
        <PageHead title="Guests" sub={`${guests.length} guest${guests.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`} />

        <form method="get" className="row" style={{ gap: 8, marginTop: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }}>
              <Icon name="search" size={18} />
            </span>
            <input className="input" name="q" defaultValue={q} placeholder="Search by name or phone…" style={{ paddingLeft: 40 }} />
          </div>
          <button className="btn btn--dark">Search</button>
          {q && <Link href="/guests" className="btn btn--ghost">Clear</Link>}
        </form>

        <div className="col" style={{ gap: 12, marginTop: 16 }}>
          {guests.length === 0 ? (
            <EmptyState>No guests match your search.</EmptyState>
          ) : (
            guests.map((g) => (
              <Link key={g.id} href={`/guests/${g.id}`} className="card" style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: g.blocked ? "var(--danger-50)" : "var(--teal-50)", color: g.blocked ? "var(--danger-700)" : "var(--teal-700)", display: "grid", placeItems: "center", fontWeight: 700, flex: "none" }}>
                  {initials(g.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 7 }}>
                    <span style={{ fontWeight: 600, fontSize: 15.5 }}>{g.name}</span>
                    {g._count.reservations >= 2 && <span className="pill pill--teal">Repeat</span>}
                    {g.blocked && <span className="pill pill--danger">Blocked</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--subtle)" }}>
                    {g.phone}{g.email ? ` · ${g.email}` : ""}
                  </div>
                </div>
                <span className="pill pill--ink">{g._count.reservations} {g._count.reservations === 1 ? "stay" : "stays"}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
