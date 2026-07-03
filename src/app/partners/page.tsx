import { requireRole } from "@/lib/session";
import { listPartners } from "@/lib/partners";
import { PageHead } from "@/components/ui";
import { PartnersBoard } from "@/components/PartnersBoard";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  await requireRole(["owner", "reception"]);
  const partners = await listPartners();

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Partners" sub="Your contact list of places and people you work with — guesthouses, hotels, drivers, agents." />
        <PartnersBoard
          partners={partners.map((p) => ({ id: p.id, name: p.name, kind: p.kind, phone: p.phone, locality: p.locality, rating: p.rating, notes: p.notes }))}
        />
      </div>
    </main>
  );
}
