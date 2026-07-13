import Link from "next/link";
import { requireRole } from "@/lib/session";
import { PageHead } from "@/components/ui";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { PushToggle } from "@/components/PushToggle";

export const dynamic = "force-dynamic";

// Not capped at a narrow reading column like the other screens: this renders a
// generated workspace (KPI tiles, charts) beside the conversation on a desktop, so
// it needs the width. On a phone it collapses to a single column.
export default async function AssistantPage() {
  await requireRole(["owner"]);

  return (
    <main className="app-main">
      <div className="entrance">
        <PageHead
          title="Owner console"
          sub="Ask about your day, your revenue, or what needs your attention — I'll build the answer."
          right={<Link className="btn btn--ghost btn--sm" href="/assistant/log">Chat log</Link>}
        />
        <PushToggle />
        <AssistantChat
          variant="console"
          emptyTitle="What do you want to know?"
          emptySub="Ask about today, revenue, or what needs your attention — I'll build it into a workspace."
          placeholder="Ask about your day, revenue, occupancy…"
          suggestions={[
            "How's today looking?",
            "Show revenue for last month",
            "Anything need my attention?",
            "Who's arriving this week?",
          ]}
        />
      </div>
    </main>
  );
}
