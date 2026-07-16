import { getCancellationPolicy } from "@/lib/cancellation";
import { SubHeader } from "@/components/settings/SubHeader";
import { CancellationSection } from "@/components/settings/CancellationSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  const policy = await getCancellationPolicy();
  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Cancellation & refunds" sub="Refund ladder — how much a guest gets back, by how far ahead they cancel" />
        <CancellationSection initial={policy} />
      </div>
    </main>
  );
}
