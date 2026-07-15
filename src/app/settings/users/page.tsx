import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/session";
import { listUserProperties } from "@/lib/properties";
import { SubHeader } from "@/components/settings/SubHeader";
import { UsersSection, type UserRow } from "@/components/settings/UsersSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]); // belt-and-suspenders (middleware also gates)
  const session = await getSession();

  // All logins in this deployment (= this client's staff — one database per client),
  // not just the current property's. The owner manages everyone from here.
  const [users, grants, properties] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, role: true, active: true, propertyId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userProperty.findMany({ select: { userId: true, propertyId: true } }),
    listUserProperties(session?.sub ?? "", session?.propertyId ?? null),
  ]);

  // Each user's accessible set = their home property + their grants.
  const byUser = new Map<string, Set<string>>();
  for (const u of users) {
    const s = new Set<string>();
    if (u.propertyId) s.add(u.propertyId);
    byUser.set(u.id, s);
  }
  for (const g of grants) byUser.get(g.userId)?.add(g.propertyId);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    active: u.active,
    propertyIds: [...(byUser.get(u.id) ?? [])],
  }));

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Users & roles" sub="Logins for owner, reception and housekeeping — and which properties each can access" />
        <UsersSection users={rows} currentUserId={session?.sub ?? null} properties={properties} />
      </div>
    </main>
  );
}
