import Link from "next/link";
import { listMessages } from "@/lib/messaging";
import { PageHead, SectionLabel, EmptyState } from "@/components/ui";

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
  const messages = await listMessages({ limit: 200 });

  return (
    <main className="app-main" style={{ maxWidth: 720 }}>
      <div className="entrance">
        <PageHead
          title="Message outbox"
          sub="All outbound messages logged by agents and the system"
        />
        <p style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 16 }}>
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
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                      {CHANNEL_LABEL[m.channel] ?? m.channel} → {m.to}
                    </span>
                    <span className="pill" style={{ fontSize: 11 }}>
                      {SOURCE_LABEL[m.source] ?? m.source}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: STATUS_COLOR[m.status] ?? "var(--text-subtle)", fontWeight: 600 }}>
                    {m.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.body}
                </div>
                <div className="row" style={{ gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {m.guest && (
                    <Link href={`/guests/${m.guest.id}`} style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                      {m.guest.name}
                    </Link>
                  )}
                  <span className="faint" style={{ fontSize: 12 }}>
                    {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
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
