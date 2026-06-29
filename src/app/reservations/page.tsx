import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHead, ChannelBadge, StatusPill } from "@/components/ui";

const STATUS_KIND: Record<string, "good" | "warn" | "danger" | "ink"> = {
  confirmed: "good",
  cancelled: "ink",
  no_show: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No-show",
};
import { displayDate, displayMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(status ? { status: status as "confirmed" | "cancelled" | "no_show" } : {}),
      ...(q
        ? {
            OR: [
              { guest: { name: { contains: q, mode: "insensitive" } } },
              { guest: { phone: { contains: q } } },
              { room: { label: { contains: q, mode: "insensitive" } } },
              { otaRef: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      guest: { select: { id: true, name: true, phone: true } },
      room: { select: { id: true, label: true } },
      channel: { select: { id: true, name: true } },
    },
    orderBy: [{ checkIn: "desc" }],
    take: 200,
  });

  const counts = {
    all: await prisma.reservation.count(),
    confirmed: await prisma.reservation.count({ where: { status: "confirmed" } }),
    cancelled: await prisma.reservation.count({ where: { status: "cancelled" } }),
    no_show: await prisma.reservation.count({ where: { status: "no_show" } }),
  };

  const statusTabs = [
    { key: "", label: "All", count: counts.all },
    { key: "confirmed", label: "Confirmed", count: counts.confirmed },
    { key: "cancelled", label: "Cancelled", count: counts.cancelled },
    { key: "no_show", label: "No-show", count: counts.no_show },
  ];

  function stayDates(r: (typeof reservations)[number]) {
    const nights = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000);
    return `${displayDate(r.checkIn)} → ${displayDate(r.checkOut)} (${nights}n)`;
  }

  return (
    <main className="app-main" style={{ maxWidth: 820 }}>
      <div className="entrance">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <PageHead title="Reservations" sub={`${counts.all} total`} />
          <Link href="/reservations/new" className="btn btn--primary" style={{ flexShrink: 0 }}>
            + New booking
          </Link>
        </div>

        {/* Search */}
        <form method="GET" style={{ marginBottom: 14 }}>
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search guest name, phone, room or OTA ref…"
            className="input"
            style={{ width: "100%" }}
          />
        </form>

        {/* Status filter tabs */}
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          {statusTabs.map((t) => (
            <Link
              key={t.key}
              href={`/reservations${t.key ? `?status=${t.key}` : ""}${q ? `${t.key ? "&" : "?"}q=${encodeURIComponent(q)}` : ""}`}
              className={`pill${(!status && t.key === "") || status === t.key ? " pill--active" : ""}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.label} <span style={{ opacity: 0.65 }}>{t.count}</span>
            </Link>
          ))}
        </div>

        {/* List */}
        {reservations.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-subtle)", fontSize: 14 }}>
            No reservations found.
          </div>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {reservations.map((r) => (
              <Link key={r.id} href={`/reservations/${r.id}`} className="card card--link" style={{ padding: "12px 14px" }}>
                <div className="spread" style={{ marginBottom: 4 }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                      {r.guest.name}
                    </span>
                    <ChannelBadge name={r.channel.name} />
                  </div>
                  <StatusPill kind={STATUS_KIND[r.status] ?? "ink"}>{STATUS_LABEL[r.status] ?? r.status}</StatusPill>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 3 }}>
                  {r.room.label} · {stayDates(r)}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                    {displayMoney(r.grossAmount)}
                  </span>
                  {r.otaRef && (
                    <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                      Ref: {r.otaRef}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-faint)", marginLeft: "auto" }}>
                    {r.guest.phone}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
