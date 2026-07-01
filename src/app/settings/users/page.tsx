import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/session";
import { SubHeader } from "@/components/settings/SubHeader";
import { UsersSection, type UserRow } from "@/components/settings/UsersSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]); // belt-and-suspenders (middleware also gates)
  const session = await getSession();
  const users = await prisma.user.findMany({
    where: session?.propertyId ? { propertyId: session.propertyId } : {},
    select: { id: true, email: true, role: true, active: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Users & roles" sub="Logins for owner, reception and housekeeping" />
        <UsersSection users={users as UserRow[]} currentUserId={session?.sub ?? null} />
      </div>
    </main>
  );
}
