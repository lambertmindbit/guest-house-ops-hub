import { requireRole } from "@/lib/session";
import { listPolicies } from "@/lib/policies";
import { SubHeader } from "@/components/settings/SubHeader";
import { AssistantRulesSection } from "@/components/settings/AssistantRulesSection";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireRole(["owner"]);
  const policies = await listPolicies();

  return (
    <main className="app-main" style={{ maxWidth: 760 }}>
      <div className="entrance">
        <SubHeader title="Assistant rules" sub="Owner guidance the chat assistant follows" />
        <AssistantRulesSection policies={policies} />
      </div>
    </main>
  );
}
