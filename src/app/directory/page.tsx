import { getSession, requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { searchDirectory, DIRECTORY_NEEDS, PRICE_BANDS } from "@/lib/community/directory";
import { DirectoryClient } from "@/components/DirectoryClient";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string | string[]; priceBand?: string }>;
}) {
  await requireModule("directory");
  await requireRole(["owner", "reception"]);
  const session = await getSession();
  const sp = await searchParams;
  const needs = Array.isArray(sp.need) ? sp.need : sp.need ? [sp.need] : [];
  const priceBand = sp.priceBand ?? null;

  const entries = session?.propertyId
    ? await searchDirectory(session.propertyId, { needs, priceBand })
    : [];

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <PageHead title="Directory" sub="Find nearby properties by what they offer — refer guests you can't take." />
        <DirectoryClient
          entries={entries}
          needs={DIRECTORY_NEEDS}
          priceBands={PRICE_BANDS}
          activeNeeds={needs}
          activePriceBand={priceBand}
        />
      </div>
    </main>
  );
}
