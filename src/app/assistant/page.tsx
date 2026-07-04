import { requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireRole(["owner", "reception"]);

  return (
    <main className="app-main" style={{ maxWidth: 680 }}>
      <div className="entrance">
        <PageHead title="Assistant" sub="Ask about availability and prices — a preview of the guest booking assistant." />
        <AssistantChat />
      </div>
    </main>
  );
}
