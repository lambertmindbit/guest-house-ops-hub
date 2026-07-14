import Link from "next/link";
import { listMessages } from "@/lib/messaging";
import { displayDate } from "@/lib/format";
import { PageHead, SectionLabel, EmptyState } from "@/components/ui";
import { requireModule } from "@/lib/module-gate";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  manual: "Manual",
};

const SOURCE_LABEL: Record<string, string> = {
  assistant: "Assistant",
  cab: "Cab agent",
  console: "Console",
  system: "System",
};

const STATUS_COLOR: Record<string, string> = {
  logged: "var(--text-subtle)",
  queued: "var(--warn-text, #b45309)",
  sent: "var(--good-text, #15803d)",
  failed: "var(--red-text, #dc2626)",
};

export default async function MessagesPage() {
  await requireModule("messages");
  const messages = await listMessages({ limit: 200 });

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <PageHead
          title="Message outbox"
          sub="All outbound messages logged by agents and the system"
        />
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-subtle)", marginBottom: 16 }}>
          Messages are logged here when an agent or system trigger sends (or tries to send) a guest communication. Status <b>logged</b> means no provider is configured yet — delivery will happen automatically once WhatsApp / SMS is set up.
        </p>

        <SectionLabel count={`(${messages.length})`}>All messages</SectionLabel>

        {messages.length === 0 ? (
          <EmptyState>No messages yet. Agents send messages via POST /api/agent/messages.</EmptyState>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {messages.map((m) => (
              <div key={m.id} className="card" style={{ padding: "12px 14px" }}>
                <div className="spread" style={{ marginBottom: 4 }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--ink)" }}>
                      {CHANNEL_LABEL[m.channel] ?? m.channel} → {m.to}
                    </span>
                    <span className="badge badge--neutral">
                      {SOURCE_LABEL[m.source] ?? m.source}
                    </span>
                  </div>
                  <span style={{ fontSize: "var(--fs-meta)", color: STATUS_COLOR[m.status] ?? "var(--text-subtle)", fontWeight: 600 }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.body}
                </div>
                <div className="row" style={{ gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {m.guest && (
                    <Link href={`/guests/${m.guest.id}`} style={{ fontSize: "var(--fs-meta)", color: "var(--text-subtle)" }}>
                      {m.guest.name}
                    </Link>
                  )}
                  <span className="faint" style={{ fontSize: "var(--fs-meta)" }}>
                    {displayDate(new Date(m.createdAt))} · {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
