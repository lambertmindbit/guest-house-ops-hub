import Link from "next/link";
import { requireRole } from "@/lib/session";
import { PageHead, EmptyState } from "@/components/ui";
import { listRecentConversations } from "@/lib/conversations";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function ChatLogPage() {
  await requireRole(["owner", "reception"]);
  const conversations = await listRecentConversations();

  return (
    <main className="app-main" style={{ maxWidth: 680 }}>
      <div className="entrance">
        <PageHead
          title="Chat log"
          sub="Recent assistant conversations — guest widget and owner console."
          right={<Link className="btn btn--ghost btn--sm" href="/assistant">Console</Link>}
        />

        {conversations.length === 0 ? (
          <EmptyState>No conversations yet.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {conversations.map((c) => (
              <article key={c.sessionId} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                  <span className={`badge ${c.mode === "owner" ? "badge--good" : "badge--neutral"}`}>
                    {c.mode === "owner" ? "Owner console" : "Guest widget"}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>{when(c.lastAt)}</span>
                </div>
                <div className="col" style={{ gap: 10 }}>
                  {c.turns.map((t) => (
                    <div key={t.id} className="col" style={{ gap: 3 }}>
                      <p style={{ margin: 0 }}><strong>›</strong> {t.userMessage}</p>
                      <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{t.reply}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
