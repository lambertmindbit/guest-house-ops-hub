import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { currentPropertySettings } from "@/lib/property-settings";

export const dynamic = "force-dynamic";

// Public, no-login guest widget (excluded from the owner cookie in middleware).
// Dark unless PUBLIC_CHAT_ENABLED=true. Posts to /api/public/assistant, which
// runs the agent in "public" mode — availability/prices + a booking REQUEST the
// owner confirms; never a reservation.
export default async function GuestChatPage() {
  if (process.env.PUBLIC_CHAT_ENABLED !== "true") notFound();

  const settings = await currentPropertySettings().catch(() => null);
  const propertyName = settings?.publicName || settings?.name || "our guest house";

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 8px", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--fs-h2, 20px)" }}>{propertyName}</div>
        <div className="muted" style={{ fontSize: "var(--fs-small)" }}>Ask about rooms, dates and prices — we can send a booking request to the property for you.</div>
      </header>
      <AssistantChat
        endpoint="/api/public/assistant"
        intro={`Namaste! 👋 Welcome to ${propertyName}. Tell me your dates and I'll show you which rooms are free and what they cost — then I can send a booking request to the property for you.`}
      />
    </main>
  );
}
