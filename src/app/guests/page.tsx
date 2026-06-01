import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-3 text-xl font-semibold">Guests</h1>

      <form method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or phone…"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <p className="mb-2 text-xs text-neutral-500">
        {guests.length} guest{guests.length === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}
      </p>

      {guests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-400">
          No guests found.
        </p>
      ) : (
        <ul className="space-y-2">
          {guests.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{g.name}</div>
                <div className="truncate text-xs text-neutral-500">
                  {g.phone}
                  {g.email ? ` · ${g.email}` : ""}
                </div>
              </div>
              <span className="shrink-0 text-xs text-neutral-400">
                {g._count.reservations} stay{g._count.reservations === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {q && (
        <Link href="/guests" className="mt-4 inline-block text-sm text-neutral-500 hover:underline">
          Clear search
        </Link>
      )}
    </main>
  );
}
