import { getCancellationPolicy } from "@/lib/cancellation";
import { SubHeader } from "@/components/settings/SubHeader";
import { CancellationSection } from "@/components/settings/CancellationSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const policy = await getCancellationPolicy();
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Cancellation & refunds" sub="Free-cancellation windows (normal vs peak)" />
        <CancellationSection initial={policy} />
      </div>
    </main>
  );
}
