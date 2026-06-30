import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHead, EmptyState, Icon } from "@/components/ui";
import { AddGuest } from "@/components/AddGuest";
import { displayINR } from "@/lib/format";

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
    include: {
      _count: { select: { reservations: true } },
      // For the outstanding-balance badge: confirmed stays + their payments.
      reservations: {
        where: { status: "confirmed" },
        select: { grossAmount: true, payments: { select: { amount: true } } },
      },
    },
  });

  // Per-guest outstanding balance = Σ gross − Σ payments across confirmed stays.
  const balanceOf = (g: (typeof guests)[number]) =>
    g.reservations.reduce((sum, r) => {
      const gross = Number(r.grossAmount ?? 0);
      const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
      return sum + (gross - paid);
    }, 0);

  return (
    <main className="app-main">
      <div className="entrance">
        <PageHead title="Guests" sub={`${guests.length} guest${guests.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`} />

        <form method="get" className="row" style={{ gap: 8, marginTop: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)" }}>
              <Icon name="search" size={18} />
            </span>
            <input className="input" name="q" defaultValue={q} placeholder="Search by name or phone…" style={{ paddingLeft: 40 }} />
          </div>
          <button className="btn btn--ghost">Search</button>
          {q && <Link href="/guests" className="btn btn--ghost">Clear</Link>}
        </form>

        <AddGuest />

        <div className="col" style={{ gap: 12, marginTop: 16 }}>
          {guests.length === 0 ? (
            <EmptyState>No guests match your search.</EmptyState>
          ) : (
            guests.map((g) => (
              <Link key={g.id} href={`/guests/${g.id}`} className="card" style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: g.blocked ? "var(--red-bg)" : "var(--accent-bg)", color: g.blocked ? "var(--red-text)" : "var(--accent-text)", display: "grid", placeItems: "center", fontWeight: 700, flex: "none" }}>
                  {initials(g.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 15.5 }}>{g.name}</span>
                    {g._count.reservations >= 2 && <span className="badge badge--paid">Repeat</span>}
                    {g.blocked && <span className="badge badge--danger">Flagged</span>}
                    {g.nationality && <span className="badge badge--neutral">Foreign · C-Form</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>
                    {g.phone}{g.email ? ` · ${g.email}` : ""}
                  </div>
                </div>
                <div className="rowcard__right">
                  {balanceOf(g) > 0 && <span className="badge badge--warn">{displayINR(balanceOf(g))} due</span>}
                  <span className="badge badge--neutral">{g._count.reservations} {g._count.reservations === 1 ? "stay" : "stays"}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
