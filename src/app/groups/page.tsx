import Link from "next/link";
import { listGroups } from "@/lib/groups";
import { PageHead, SectionLabel, EmptyState, Icon } from "@/components/ui";
import { GroupCreate } from "@/components/GroupsClient";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await listGroups();

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Booking groups" sub="Link several room bookings into one folio (whole property / long stay)." />
        <GroupCreate />
        <SectionLabel count={groups.length}>Groups</SectionLabel>
        {groups.length === 0 ? (
          <EmptyState>No groups yet. Create one, then attach bookings to it.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {groups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="rowcard">
                <div className="rowcard__main">
                  <div className="rowcard__name">{g.name}</div>
                  <div className="rowcard__meta">{g.reservations.length} booking{g.reservations.length === 1 ? "" : "s"}</div>
                </div>
                <Icon name="chevronR" size={18} className="setrow__chev" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
