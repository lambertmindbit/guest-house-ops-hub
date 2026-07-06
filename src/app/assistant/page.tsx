import { requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireRole(["owner", "reception"]);

  return (
    <main className="app-main" style={{ maxWidth: 680 }}>
      <div className="entrance">
        <PageHead title="Owner console" sub="Ask about your day — occupancy, arrivals, check-outs and what needs your attention." />
        <AssistantChat
          intro="Hi 👋 I'm your operations assistant. Ask me how today looks, who's arriving, your occupancy, or what needs your attention."
          suggestions={["How's today looking?", "Who's arriving this week?", "Anything need my attention?"]}
        />
      </div>
    </main>
  );
}
